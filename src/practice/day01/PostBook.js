const { BiUnderline } = require("react-icons/bi");

const PostABook = async (req, res) => {
  try {
    //lay thong tin user
    const user = req.user;
    //check role
    if (user.role != "admin") {
      return res.status(403).json({ message: "Forbiden" });
    }
    //validate data
    const { title, description, author, category, price, quantity, languege } =
      req.body;
    //check title,des
    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Missing required fields Title or Description" });
    }
    //check author category
    if (!author || !category) {
      return res
        .status(400)
        .json({ message: "Missing required fields Author or category" });
    }
    const authorExists = await Author.findById(author);
    if (!authorExists) {
      return res.status(400).json({ message: "Author not found!" });
    }
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: "Category not found!" });
    }
    //check price
    if (
      !price ||
      price.newPrice === undefined ||
      price.oldPrice === undefined
    ) {
      return res.status(400).json({ message: "Price is invalid or missing!" });
    }
    if (price.newPrice < price.oldPrice) {
      return res
        .status(400)
        .json({ message: "Old Price must highter than New Price  " });
    }
    if (quantity < 0 || quantity === undefined) {
      return res.status(400).json({ message: "Quantity is invalid" });
    }
    //check language
    
  } catch (error) {}
};
