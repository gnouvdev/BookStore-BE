require("dotenv").config();

/**
 * Script tạo 500 users với đầy đủ các loại hành vi và trọng số:
 * - Mua (order): 1.0
 * - Thêm giỏ hàng (cart): 0.8
 * - Wishlist: 0.7
 * - Rating (review): 0.5-0.9 (tùy sao: 3 sao=0.5, 4 sao=0.7, 5 sao=0.9)
 * - Xem chi tiết (view): 0.5
 * - Search: 0.3
 */

const mongoose = require("mongoose");
const ViewHistory = require("../viewHistory/viewHistory.model");
const Review = require("../reviews/review.model");
const User = require("../users/user.model");
const Book = require("../books/book.model");
const Order = require("../orders/order.model");
const Cart = require("../cart/cart.model");
const SearchHistory = require("../searchHistory/searchHistory.model");
const Payment = require("../payments/payment.model");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgoMax) {
  const now = new Date();
  const daysAgo = randomInt(0, daysAgoMax);
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

async function createSyntheticUser(userIndex, groupName, interestGroup) {
  const timestamp = Date.now();
  const user = new User({
    firebaseId: `full_${groupName}_ig${interestGroup}_${userIndex}_${timestamp}`,
    email: `full_${groupName}_ig${interestGroup}_user_${userIndex}_${timestamp}@example.com`,
    password: "$2b$10$dummyHashForTestingPurposes",
    fullName: `Full Interactions ${groupName} User ${userIndex} (IG${interestGroup})`,
    phone: `0900000${String(userIndex).padStart(3, "0")}`,
    role: "user",
  });

  await user.save();
  return user;
}

async function createFullInteractionsForUser(
  user,
  books,
  numInteractions,
  popularBooks,
  groupName,
  interestGroup,
  interestGroupBooks,
  bookPriceMap
) {
  // Chọn categories ngẫu nhiên cho user
  const allCategories = [];
  for (const b of books) {
    if (b.category) {
      const cats = Array.isArray(b.category) ? b.category : [b.category];
      allCategories.push(...cats.map((c) => c.toString()));
    }
  }
  const uniqueCategories = [...new Set(allCategories)];

  const userCategories = [];
  const numCategories = randomInt(2, Math.min(5, uniqueCategories.length));
  for (let i = 0; i < numCategories && uniqueCategories.length > 0; i++) {
    const cat = randomChoice(uniqueCategories);
    if (!userCategories.includes(cat)) {
      userCategories.push(cat);
    }
  }

  const booksInCategories = books.filter((b) => {
    if (!b.category) return false;
    const cats = Array.isArray(b.category) ? b.category : [b.category];
    return cats.some((c) => userCategories.includes(c.toString()));
  });

  // Phân bổ interactions theo trọng số và nhóm
  let viewRatio, reviewRatio, wishlistRatio, cartRatio, orderRatio, searchRatio;

  if (groupName === "super") {
    // Siêu người dùng: nhiều hành vi cao cấp (order, cart, review)
    viewRatio = 0.3;
    reviewRatio = 0.25;
    wishlistRatio = 0.15;
    cartRatio = 0.15;
    orderRatio = 0.1;
    searchRatio = 0.05;
  } else if (groupName === "regular") {
    // Phổ thông: cân bằng
    viewRatio = 0.4;
    reviewRatio = 0.2;
    wishlistRatio = 0.15;
    cartRatio = 0.1;
    orderRatio = 0.1;
    searchRatio = 0.05;
  } else {
    // Cold-start: chủ yếu views và search
    viewRatio = 0.5;
    reviewRatio = 0.1;
    wishlistRatio = 0.1;
    cartRatio = 0.1;
    orderRatio = 0.1;
    searchRatio = 0.1;
  }

  const views = [];
  const reviews = [];
  const wishlistBookIds = [];
  const cartItems = [];
  const orders = [];
  const searches = [];

  // Tạo ViewHistory (xem chi tiết) - weight 0.5
  const numViews = Math.floor(numInteractions * viewRatio);
  const viewedBooks = [];

  for (let i = 0; i < numViews; i++) {
    let bookToView;
    const rand = Math.random();

    if (rand < 0.6 && interestGroupBooks.length > 0) {
      bookToView = randomChoice(interestGroupBooks);
    } else if (rand < 0.75 && popularBooks.length > 0) {
      bookToView = randomChoice(popularBooks);
    } else if (rand < 0.95 && booksInCategories.length > 0) {
      bookToView = randomChoice(booksInCategories);
    } else {
      bookToView = randomChoice(books);
    }

    if (bookToView) {
      const bookId = bookToView._id.toString();
      const viewCount = viewedBooks.filter((b) => b === bookId).length;
      const maxViewsPerBook = groupName === "super" ? 3 : 1;

      if (viewCount < maxViewsPerBook) {
        views.push({
          user: user._id,
          book: bookToView._id,
          timestamp: randomDate(180),
        });
        viewedBooks.push(bookId);
      }
    }
  }

  // Tạo Review (rating) - weight 0.5-0.9 tùy sao
  // RÀNG BUỘC WORKFLOW: chỉ review những sách đã được order bởi user
  const candidateReviewBookIds = Array.from(
    orders
      .flatMap((o) => o.productIds || [])
      .map((p) => p.productId.toString())
      .reduce((set, id) => set.add(id), new Set())
  );

  const numReviews = Math.min(
    Math.floor(numInteractions * reviewRatio),
    candidateReviewBookIds.length
  );
  const reviewedBooks = new Set();

  for (let i = 0; i < numReviews && candidateReviewBookIds.length > 0; i++) {
    const bookId = randomChoice(candidateReviewBookIds);
    if (!reviewedBooks.has(bookId)) {
      // Rating phân bổ: 60% 4-5 sao, 30% 3 sao, 10% 1-2 sao
      let rating;
      const ratingRand = Math.random();
      if (ratingRand < 0.6) {
        rating = randomInt(4, 5);
      } else if (ratingRand < 0.9) {
        rating = 3;
      } else {
        rating = randomInt(1, 2);
      }

      reviews.push({
        user: user._id,
        book: bookId,
        rating: rating,
        comment: `Synthetic review for ordered book ${i + 1}`,
        timestamp: randomDate(150),
      });
      reviewedBooks.add(bookId);
    }
  }

  // Tạo Wishlist - weight 0.7
  const numWishlist = Math.floor(numInteractions * wishlistRatio);
  for (let i = 0; i < numWishlist && books.length > 0; i++) {
    let bookToAdd;
    const rand = Math.random();

    if (rand < 0.65 && interestGroupBooks.length > 0) {
      bookToAdd = randomChoice(interestGroupBooks);
    } else if (rand < 0.8 && popularBooks.length > 0) {
      bookToAdd = randomChoice(popularBooks);
    } else if (rand < 0.95 && booksInCategories.length > 0) {
      bookToAdd = randomChoice(booksInCategories);
    } else {
      bookToAdd = randomChoice(books);
    }

    if (
      bookToAdd &&
      !wishlistBookIds.includes(bookToAdd._id.toString()) &&
      !viewedBooks.includes(bookToAdd._id.toString())
    ) {
      wishlistBookIds.push(bookToAdd._id);
    }
  }

  // Tạo Cart (thêm giỏ hàng) - weight 0.8
  const numCart = Math.floor(numInteractions * cartRatio);
  const cartBookIds = new Set();

  for (let i = 0; i < numCart && books.length > 0; i++) {
    let bookToAdd;
    const rand = Math.random();

    if (rand < 0.5 && interestGroupBooks.length > 0) {
      bookToAdd = randomChoice(interestGroupBooks);
    } else if (rand < 0.7 && popularBooks.length > 0) {
      bookToAdd = randomChoice(popularBooks);
    } else if (rand < 0.9 && booksInCategories.length > 0) {
      bookToAdd = randomChoice(booksInCategories);
    } else {
      bookToAdd = randomChoice(books);
    }

    if (bookToAdd && !cartBookIds.has(bookToAdd._id.toString())) {
      const bookId = bookToAdd._id.toString();
      // Lấy price từ bookPriceMap hoặc random nếu không có
      const price = bookPriceMap
        ? bookPriceMap.get(bookId) || randomInt(100000, 500000)
        : randomInt(100000, 500000);
      cartItems.push({
        book: bookToAdd._id,
        quantity: randomInt(1, 3),
        price: typeof price === "number" ? price : randomInt(100000, 500000),
      });
      cartBookIds.add(bookId);
    }
  }

  // Tạo Order (mua) - weight 1.0
  const numOrders = Math.floor(numInteractions * orderRatio);
  const orderedBookIds = new Set();

  for (let i = 0; i < numOrders && books.length > 0; i++) {
    let bookToOrder;
    const rand = Math.random();

    // Orders thường từ cart hoặc wishlist
    if (rand < 0.4 && cartBookIds.size > 0) {
      const cartBookId =
        Array.from(cartBookIds)[randomInt(0, cartBookIds.size - 1)];
      bookToOrder = books.find((b) => b._id.toString() === cartBookId);
    } else if (rand < 0.7 && wishlistBookIds.length > 0) {
      bookToOrder = books.find((b) => wishlistBookIds.includes(b._id));
    } else if (rand < 0.85 && interestGroupBooks.length > 0) {
      bookToOrder = randomChoice(interestGroupBooks);
    } else if (popularBooks.length > 0) {
      bookToOrder = randomChoice(popularBooks);
    } else {
      bookToOrder = randomChoice(books);
    }

    if (bookToOrder && !orderedBookIds.has(bookToOrder._id.toString())) {
      orders.push({
        productIds: [
          {
            productId: bookToOrder._id,
            quantity: randomInt(1, 2),
          },
        ],
        timestamp: randomDate(120), // Orders trong 4 tháng gần đây
      });
      orderedBookIds.add(bookToOrder._id.toString());
    }
  }

  // Tạo Search - weight 0.3
  const numSearches = Math.floor(numInteractions * searchRatio);
  const searchQueries = [
    "sách hay",
    "tiểu thuyết",
    "khoa học",
    "lịch sử",
    "văn học",
    "kinh tế",
    "công nghệ",
    "tâm lý",
    "phát triển bản thân",
    "thiếu nhi",
  ];

  for (let i = 0; i < numSearches; i++) {
    const query = randomChoice(searchQueries);
    // Giả định user search và click vào một book từ interest group hoặc popular
    let clickedBook = null;
    if (Math.random() < 0.6 && interestGroupBooks.length > 0) {
      clickedBook = randomChoice(interestGroupBooks);
    } else if (popularBooks.length > 0) {
      clickedBook = randomChoice(popularBooks);
    } else {
      clickedBook = randomChoice(books);
    }

    // Lưu search (SearchHistory model hiện tại chỉ lưu user + query + timestamp)
    searches.push({
      user: user._id,
      query: query,
      timestamp: randomDate(180),
    });
  }

  // Insert vào database
  if (views.length > 0) {
    await ViewHistory.insertMany(views);
  }
  if (reviews.length > 0) {
    await Review.insertMany(reviews);
  }
  if (wishlistBookIds.length > 0) {
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { wishlist: { $each: wishlistBookIds } },
    });
  }
  if (cartItems.length > 0) {
    // Cart model yêu cầu firebaseId
    const cart = new Cart({
      user: user._id,
      firebaseId: user.firebaseId || `cart_${user._id.toString()}`,
      items: cartItems,
      updatedAt: randomDate(150),
    });
    await cart.save();
  }

  if (searches.length > 0) {
    // Lưu SearchHistory vào DB
    await SearchHistory.insertMany(searches);
  }

  // Orders sẽ được tạo sau khi có paymentMethodId
  // Lưu orders (metadata) để tạo sau ở hàm main
  return {
    views: views.length,
    reviews: reviews.length,
    wishlist: wishlistBookIds.length,
    cart: cartItems.length,
    orders: orders,
    searches: searches.length,
    total:
      views.length +
      reviews.length +
      wishlistBookIds.length +
      cartItems.length +
      orders.length +
      searches.length,
  };
}

async function deleteAllUsersAndInteractions() {
  console.log("🗑️  Đang xóa users và interactions cũ (GIỮ LẠI ADMIN USERS)...");

  // Xóa interactions của tất cả users (bao gồm cả admin)
  const viewResult = await ViewHistory.deleteMany({});
  const reviewResult = await Review.deleteMany({});
  const orderResult = await Order.deleteMany({});
  const cartResult = await Cart.deleteMany({});
  const searchResult = await SearchHistory.deleteMany({});

  // CHỈ xóa users có role="user" hoặc không có role, GIỮ LẠI admin users
  const userResult = await User.deleteMany({
    $or: [{ role: { $ne: "admin" } }, { role: { $exists: false } }],
  });

  // Đếm số admin users được giữ lại
  const adminCount = await User.countDocuments({ role: "admin" });

  console.log(`✅ Đã xóa:`);
  console.log(
    `  - ${userResult.deletedCount} users (chỉ users thường, không xóa admin)`
  );
  console.log(`  - ${viewResult.deletedCount} ViewHistory`);
  console.log(`  - ${reviewResult.deletedCount} Reviews`);
  console.log(`  - ${orderResult.deletedCount} Orders`);
  console.log(`  - ${cartResult.deletedCount} Carts`);
  console.log(`  - ${searchResult.deletedCount} SearchHistory`);
  console.log(`  - ${adminCount} admin users được GIỮ LẠI`);
}

async function main() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    console.error("❌ Thiếu biến môi trường DB_URL");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("TẠO 500 USERS VỚI ĐẦY ĐỦ CÁC LOẠI HÀNH VI VÀ TRỌNG SỐ");
  console.log("=".repeat(60));
  console.log("Trọng số:");
  console.log("  - Mua (order): 1.0");
  console.log("  - Thêm giỏ hàng (cart): 0.8");
  console.log("  - Wishlist: 0.7");
  console.log("  - Rating (review): 0.5-0.9 (3 sao=0.5, 4 sao=0.7, 5 sao=0.9)");
  console.log("  - Xem chi tiết (view): 0.5");
  console.log("  - Search: 0.3");
  console.log("=".repeat(60));

  console.log("\n🔄 Đang kết nối MongoDB...");
  await mongoose.connect(dbUrl);
  console.log("✅ Đã kết nối MongoDB");

  try {
    await deleteAllUsersAndInteractions();

    const books = await Book.find({}).select("_id category author").lean();

    if (!books.length) {
      console.log("⚠️ Không có books để tạo interactions.");
      return;
    }

    // Fetch books với price để tạo bookPriceMap
    const booksWithPrice = await Book.find({}).select("_id price").lean();
    const bookPriceMap = new Map(
      booksWithPrice.map((b) => {
        let price = randomInt(100000, 500000);
        if (b.price) {
          // Price có thể là object {oldPrice, newPrice} hoặc number
          if (typeof b.price === "object" && b.price.newPrice) {
            price = b.price.newPrice;
          } else if (typeof b.price === "number") {
            price = b.price;
          }
        }
        return [b._id.toString(), price];
      })
    );

    console.log(`📚 Books: ${books.length}`);

    const numPopularBooks = Math.max(5, Math.floor(books.length * 0.075));
    const popularBooks = books.slice(0, numPopularBooks);
    console.log(
      `📖 Popular books: ${popularBooks.length} sách (${(
        (popularBooks.length / books.length) *
        100
      ).toFixed(1)}%)`
    );

    // Tạo Interest Groups
    const NUM_INTEREST_GROUPS = 4;
    const booksPerGroup = Math.floor(books.length / NUM_INTEREST_GROUPS);
    const interestGroupBooks = [];

    for (let ig = 0; ig < NUM_INTEREST_GROUPS; ig++) {
      const start = ig * booksPerGroup;
      const end =
        ig === NUM_INTEREST_GROUPS - 1
          ? books.length
          : (ig + 1) * booksPerGroup;
      const groupBooks = books.slice(start, end);
      const overlapBooks = [
        ...groupBooks,
        ...popularBooks,
        ...books
          .slice(
            ((ig + 1) % NUM_INTEREST_GROUPS) * booksPerGroup,
            (((ig + 1) % NUM_INTEREST_GROUPS) + 1) * booksPerGroup
          )
          .slice(0, 5),
      ];
      interestGroupBooks.push(overlapBooks);
      console.log(`  Interest Group ${ig + 1}: ${overlapBooks.length} sách`);
    }

    const groups = [
      {
        name: "super",
        label: "Siêu người dùng",
        count: 50,
        minInteractions: 1500,
        maxInteractions: 3000,
      },
      {
        name: "regular",
        label: "Phổ thông",
        count: 200,
        minInteractions: 60,
        maxInteractions: 120,
      },
      {
        name: "coldstart",
        label: "Cold-start",
        count: 250,
        minInteractions: 3,
        maxInteractions: 8,
      },
    ];

    // Tìm hoặc tạo một payment method
    let paymentMethodId = null;
    const existingPayment = await Payment.findOne({});
    if (existingPayment) {
      paymentMethodId = existingPayment._id;
    } else {
      // Tạo payment method mặc định nếu chưa có
      const defaultPayment = new Payment({
        name: "Cash",
        description: "Cash on delivery",
        enabled: true,
      });
      await defaultPayment.save();
      paymentMethodId = defaultPayment._id;
    }

    const allStats = {
      super: { users: [], interactions: [] },
      regular: { users: [], interactions: [] },
      coldstart: { users: [], interactions: [] },
    };

    const allOrders = []; // Lưu tất cả orders để tạo sau

    for (const group of groups) {
      console.log(`\n📊 ${group.label} (${group.count} users)...`);

      for (let i = 0; i < group.count; i++) {
        const interestGroup = i % NUM_INTEREST_GROUPS;
        const user = await createSyntheticUser(
          i + 1,
          group.name,
          interestGroup
        );
        const numInteractions = randomInt(
          group.minInteractions,
          group.maxInteractions
        );

        const stats = await createFullInteractionsForUser(
          user,
          books,
          numInteractions,
          popularBooks,
          group.name,
          interestGroup,
          interestGroupBooks[interestGroup],
          bookPriceMap
        );

        // Lưu orders để tạo sau
        if (stats.orders && stats.orders.length > 0) {
          for (const order of stats.orders) {
            allOrders.push({
              ...order,
              user: user._id,
              paymentMethod: paymentMethodId,
              phone: user.phone || `0900000${String(user._id).slice(-3)}`,
              email: user.email || `user_${user._id}@example.com`,
              name: user.fullName || `User ${user._id}`,
            });
          }
        }

        allStats[group.name].users.push(user._id);
        allStats[group.name].interactions.push(stats.total);

        if ((i + 1) % 25 === 0) {
          console.log(`  ✓ Đã tạo ${i + 1}/${group.count} users...`);
        }
      }
    }

    // Tính toán thống kê
    console.log("\n" + "=".repeat(60));
    console.log("📊 BẢNG THỐNG KÊ TÓM TẮT");
    console.log("=".repeat(60));

    const calculateStats = (interactions) => {
      if (interactions.length === 0) return { mean: 0, median: 0, total: 0 };
      const sorted = [...interactions].sort((a, b) => a - b);
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      return {
        mean: interactions.reduce((a, b) => a + b, 0) / interactions.length,
        median: median,
        total: interactions.reduce((a, b) => a + b, 0),
      };
    };

    let grandTotal = 0;
    let grandTotalUsers = 0;

    for (const group of groups) {
      const stats = calculateStats(allStats[group.name].interactions);
      grandTotal += stats.total;
      grandTotalUsers += allStats[group.name].users.length;

      console.log(`\n${group.label}:`);
      console.log(`  - Số users: ${allStats[group.name].users.length}`);
      console.log(`  - Tổng interactions: ${stats.total}`);
      console.log(`  - Mean: ${stats.mean.toFixed(2)} interactions/user`);
    }

    // Tạo tất cả orders
    if (allOrders.length > 0) {
      console.log(`\n📦 Đang tạo ${allOrders.length} orders...`);
      const orderDocs = allOrders.map((order) => {
        const totalPrice = order.productIds.reduce((sum, item) => {
          const bookId = item.productId.toString();
          const price = bookPriceMap.get(bookId) || 200000;
          return sum + price * (item.quantity || 1);
        }, 0);

        return {
          user: order.user,
          productIds: order.productIds,
          createdAt: order.timestamp,
          status: "completed",
          paymentMethod: order.paymentMethod,
          totalPrice: totalPrice,
          phone: order.phone,
          email: order.email,
          name: order.name,
          address: {
            city: "Ho Chi Minh",
            district: "District 1",
            ward: "Ward 1",
            street: "123 Main Street",
          },
        };
      });

      try {
        await Order.insertMany(orderDocs, { ordered: false });
        console.log(`  ✅ Đã tạo ${orderDocs.length} orders`);
      } catch (err) {
        console.log(
          `  ⚠️  Một số orders không thể tạo (có thể do validation): ${err.message}`
        );
      }
    }

    console.log("\n" + "-".repeat(60));
    console.log("TỔNG HỢP:");
    console.log(`  - Tổng số users: ${grandTotalUsers}`);
    console.log(`  - Tổng số interactions: ${grandTotal}`);

    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Tổng số users trong database: ${totalUsers}`);
    console.log("\n💡 Bước tiếp theo:");
    console.log("   1. cd backend && node src/utils/exportInteractions.js");
    console.log(
      "   2. cd recommedationsystem && python run_original_experiment.py"
    );
  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Đã ngắt kết nối MongoDB");
  }
}

main().catch(console.error);
