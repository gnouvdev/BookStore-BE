/**
 * Lấy thông tin ngày lễ dựa trên ngày hiện tại
 * @returns {Object} { isHoliday: boolean, isNearHoliday: boolean, holidayName: string, upcomingHoliday: Object, tags: string[], daysUntil: number }
 */
function getHolidayContext() {
  // TEST: giả lập ngày 1/6
  const now = new Date(2025, 5, 1); // 1/6/2025

  const month = now.getMonth() + 1;
  const day = now.getDate();
  // const now = new Date();
  // const month = now.getMonth() + 1; // 1-12
  // const day = now.getDate();
  const year = now.getFullYear();

  // Tính ngày lễ di động (âm lịch được tính gần đúng)
  const holidays = [];
  const nearHolidays = []; // Ngày lễ sắp tới (trong 7 ngày)

  // Ngày lễ cố định
  // Tết Dương lịch (1/1)
  if (month === 1 && day === 1) {
    holidays.push({
      name: "Tết Dương lịch",
      tags: ["tết", "năm mới", "chúc mừng", "hy vọng", "khởi đầu mới"],
    });
  }

  // Tết Nguyên Đán

  if (month === 1 && day >= 20) {
    holidays.push({
      name: "Tết Nguyên Đán",
      tags: [
        "tết",
        "tết nguyên đán",
        "năm mới",
        "gia đình",
        "sum họp",
        "truyền thống",
        "văn hóa việt nam",
        "lì xì",
        "chúc tết",
      ],
    });
  }
  if (month === 2 && day <= 20) {
    holidays.push({
      name: "Tết Nguyên Đán",
      tags: [
        "tết",
        "tết nguyên đán",
        "năm mới",
        "gia đình",
        "sum họp",
        "truyền thống",
        "văn hóa việt nam",
        "lì xì",
        "chúc tết",
      ],
    });
  }

  // Ngày Quốc tế Phụ nữ (8/3)
  if (month === 3 && day === 8) {
    holidays.push({
      name: "Ngày Quốc tế Phụ nữ",
      tags: [
        "phụ nữ",
        "nữ quyền",
        "giới tính",
        "bình đẳng",
        "tôn vinh phụ nữ",
        "phụ nữ thành công",
      ],
    });
  }

  // Ngày Giỗ Tổ Hùng Vương (10/3 âm lịch, tính gần đúng là 10/4 dương lịch)
  if (month === 4 && day === 10) {
    holidays.push({
      name: "Giỗ Tổ Hùng Vương",
      tags: [
        "lịch sử việt nam",
        "truyền thống",
        "tổ tiên",
        "dân tộc",
        "văn hóa",
        "hùng vương",
      ],
    });
  }

  // Ngày Giải phóng miền Nam (30/4)
  if (month === 4 && day === 30) {
    holidays.push({
      name: "Ngày Giải phóng miền Nam",
      tags: [
        "lịch sử việt nam",
        "chiến tranh",
        "hòa bình",
        "độc lập",
        "thống nhất",
      ],
    });
  }

  // Ngày Quốc tế Lao động (1/5)
  if (month === 5 && day === 1) {
    holidays.push({
      name: "Ngày Quốc tế Lao động",
      tags: ["lao động", "công nhân", "xã hội", "bình đẳng", "quyền lợi"],
    });
  }

  // Ngày Quốc tế Thiếu nhi (1/6)
  if (month === 6 && day === 1) {
    holidays.push({
      name: "Ngày Quốc tế Thiếu nhi",
      tags: [
        "thiếu nhi",
        "trẻ em",
        "trẻ con",
        "thiếu niên",
        "giáo dục trẻ em",
        "sách thiếu nhi",
      ],
    });
  }

  // Ngày của Cha (Chủ nhật thứ 3 của tháng 6, tính gần đúng)
  if (month === 6 && day >= 15 && day <= 21) {
    holidays.push({
      name: "Ngày của Cha",
      tags: ["cha", "bố", "gia đình", "tình cha con", "gia đình"],
    });
  }

  // Ngày của Mẹ (Chủ nhật thứ 2 của tháng 5, tính gần đúng)
  if (month === 5 && day >= 8 && day <= 14) {
    holidays.push({
      name: "Ngày của Mẹ",
      tags: ["mẹ", "má", "gia đình", "tình mẹ con", "tình cảm"],
    });
  }

  // Ngày Thương binh Liệt sĩ (27/7)
  if (month === 7 && day === 27) {
    holidays.push({
      name: "Ngày Thương binh Liệt sĩ",
      tags: [
        "lịch sử",
        "chiến tranh",
        "anh hùng",
        "hy sinh",
        "tổ quốc",
        "lịch sử việt nam",
      ],
    });
  }

  // Ngày Quốc khánh (2/9)
  if (month === 9 && day === 2) {
    holidays.push({
      name: "Ngày Quốc khánh",
      tags: [
        "quốc khánh",
        "độc lập",
        "tổ quốc",
        "việt nam",
        "lịch sử",
        "dân tộc",
      ],
    });
  }

  // Ngày Phụ nữ Việt Nam (20/10)
  if (month === 10 && day === 20) {
    holidays.push({
      name: "Ngày Phụ nữ Việt Nam",
      tags: ["phụ nữ việt nam", "phụ nữ", "nữ quyền", "tôn vinh", "bình đẳng"],
    });
  }

  // Ngày Nhà giáo Việt Nam (20/11)
  if (month === 11 && day === 20) {
    holidays.push({
      name: "Ngày Nhà giáo Việt Nam",
      tags: [
        "giáo dục",
        "thầy cô",
        "học tập",
        "tri thức",
        "sư phạm",
        "giáo viên",
      ],
    });
  }

  // Giáng sinh (25/12)
  if (month === 12 && day === 25) {
    holidays.push({
      name: "Giáng sinh",
      tags: [
        "giáng sinh",
        "noel",
        "christmas",
        "tặng quà",
        "yêu thương",
        "gia đình",
        "tôn giáo",
      ],
    });
  }

  // Tết Tây (31/12)
  if (month === 12 && day === 31) {
    holidays.push({
      name: "Đêm Giao thừa",
      tags: [
        "giao thừa",
        "năm mới",
        "countdown",
        "chúc mừng",
        "hy vọng",
        "khởi đầu",
      ],
    });
  }

  // Ngày lễ tình nhân (14/2)
  if (month === 2 && day === 14) {
    holidays.push({
      name: "Valentine",
      tags: [
        "tình yêu",
        "valentine",
        "lãng mạn",
        "tặng quà",
        "tình cảm",
        "yêu đương",
      ],
    });
  }

  // Ngày Halloween (31/10)
  if (month === 10 && day === 31) {
    holidays.push({
      name: "Halloween",
      tags: ["halloween", "kinh dị", "ma quỷ", "bí ẩn", "huyền bí", "giải trí"],
    });
  }

  // Nếu có ngày lễ, trả về thông tin
  if (holidays.length > 0) {
    // Gộp tất cả tags từ các ngày lễ
    const allTags = holidays.reduce((acc, holiday) => {
      return [...acc, ...holiday.tags];
    }, []);

    // Gộp tên ngày lễ nếu có nhiều ngày lễ sát nhau
    const holidayName =
      holidays.length > 1
        ? holidays.map((h) => h.name).join(" & ")
        : holidays[0].name;

    return {
      isHoliday: true,
      isNearHoliday: false,
      holidayName: holidayName,
      holidays: holidays.map((h) => h.name),
      tags: [...new Set(allTags)], // Loại bỏ trùng lặp
    };
  }

  // Kiểm tra khoảng thời gian gần ngày lễ (trước 7 ngày)
  const nearHoliday = getNearHoliday(month, day, year);
  if (nearHoliday) {
    return {
      isHoliday: false,
      isNearHoliday: true,
      holidayName: nearHoliday.name,
      upcomingHoliday: nearHoliday.name,
      tags: nearHoliday.tags,
      daysUntil: nearHoliday.daysUntil || 0,
    };
  }

  return {
    isHoliday: false,
    isNearHoliday: false,
    tags: [],
  };
}

/**
 * Kiểm tra xem có ngày lễ sắp tới trong 7 ngày không
 */
function getNearHoliday(month, day, year) {
  const now = new Date(year, month - 1, day);
  now.setHours(0, 0, 0, 0); // Reset time to start of day for accurate calculation
  const upcomingHolidays = [];

  // Helper function to calculate days until a holiday
  const calculateDaysUntil = (holidayDate) => {
    holidayDate.setHours(0, 0, 0, 0);
    const diffTime = holidayDate - now;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0; // Ensure non-negative
  };

  // Tết Dương lịch (1/1) - check 7 ngày trước
  let newYearDate = new Date(year, 0, 1);
  if (newYearDate < now) {
    newYearDate = new Date(year + 1, 0, 1);
  }
  const daysUntilNewYear = calculateDaysUntil(newYearDate);
  if (daysUntilNewYear >= 0 && daysUntilNewYear <= 7) {
    upcomingHolidays.push({
      name: "Tết Dương lịch",
      tags: ["tết", "năm mới", "chúc mừng", "hy vọng", "khởi đầu mới"],
      daysUntil: daysUntilNewYear,
    });
  }

  // Valentine (14/2) - check 7 ngày trước
  let valentineDate = new Date(year, 1, 14);
  if (valentineDate < now) {
    valentineDate = new Date(year + 1, 1, 14);
  }
  const daysUntilValentine = calculateDaysUntil(valentineDate);
  if (daysUntilValentine >= 0 && daysUntilValentine <= 7) {
    upcomingHolidays.push({
      name: "Valentine",
      tags: [
        "tình yêu",
        "valentine",
        "lãng mạn",
        "tặng quà",
        "tình cảm",
        "yêu đương",
      ],
      daysUntil: daysUntilValentine,
    });
  }

  // Ngày Quốc tế Phụ nữ (8/3) - check 7 ngày trước
  let womenDayDate = new Date(year, 2, 8);
  if (womenDayDate < now) {
    womenDayDate = new Date(year + 1, 2, 8);
  }
  const daysUntilWomenDay = calculateDaysUntil(womenDayDate);
  if (daysUntilWomenDay >= 0 && daysUntilWomenDay <= 7) {
    upcomingHolidays.push({
      name: "Ngày Quốc tế Phụ nữ",
      tags: [
        "phụ nữ",
        "nữ quyền",
        "giới tính",
        "bình đẳng",
        "tôn vinh phụ nữ",
        "phụ nữ thành công",
      ],
      daysUntil: daysUntilWomenDay,
    });
  }

  // Giỗ Tổ Hùng Vương (10/4) - check 7 ngày trước
  let hungVuongDate = new Date(year, 3, 10);
  if (hungVuongDate < now) {
    hungVuongDate = new Date(year + 1, 3, 10);
  }
  const daysUntilHungVuong = calculateDaysUntil(hungVuongDate);
  if (daysUntilHungVuong >= 0 && daysUntilHungVuong <= 7) {
    upcomingHolidays.push({
      name: "Giỗ Tổ Hùng Vương",
      tags: [
        "lịch sử việt nam",
        "truyền thống",
        "tổ tiên",
        "dân tộc",
        "văn hóa",
        "hùng vương",
      ],
      daysUntil: daysUntilHungVuong,
    });
  }

  // Ngày Giải phóng miền Nam (30/4) - check 7 ngày trước
  let liberationDate = new Date(year, 3, 30);
  if (liberationDate < now) {
    liberationDate = new Date(year + 1, 3, 30);
  }
  const daysUntilLiberation = calculateDaysUntil(liberationDate);
  if (daysUntilLiberation >= 0 && daysUntilLiberation <= 7) {
    upcomingHolidays.push({
      name: "Ngày Giải phóng miền Nam",
      tags: [
        "lịch sử việt nam",
        "chiến tranh",
        "hòa bình",
        "độc lập",
        "thống nhất",
      ],
      daysUntil: daysUntilLiberation,
    });
  }

  // Ngày Quốc tế Lao động (1/5) - check 7 ngày trước
  let laborDate = new Date(year, 4, 1);
  if (laborDate < now) {
    laborDate = new Date(year + 1, 4, 1);
  }
  const daysUntilLabor = calculateDaysUntil(laborDate);
  if (daysUntilLabor >= 0 && daysUntilLabor <= 7) {
    upcomingHolidays.push({
      name: "Ngày Quốc tế Lao động",
      tags: ["lao động", "công nhân", "xã hội", "bình đẳng", "quyền lợi"],
      daysUntil: daysUntilLabor,
    });
  }

  // Ngày Quốc tế Thiếu nhi (1/6) - check 7 ngày trước
  let childrenDate = new Date(year, 5, 1);
  if (childrenDate < now) {
    childrenDate = new Date(year + 1, 5, 1);
  }
  const daysUntilChildren = calculateDaysUntil(childrenDate);
  if (daysUntilChildren >= 0 && daysUntilChildren <= 7) {
    upcomingHolidays.push({
      name: "Ngày Quốc tế Thiếu nhi",
      tags: [
        "thiếu nhi",
        "trẻ em",
        "trẻ con",
        "thiếu niên",
        "giáo dục trẻ em",
        "sách thiếu nhi",
      ],
      daysUntil: daysUntilChildren,
    });
  }

  // Ngày Thương binh Liệt sĩ (27/7) - check 7 ngày trước
  let martyrsDate = new Date(year, 6, 27);
  if (martyrsDate < now) {
    martyrsDate = new Date(year + 1, 6, 27);
  }
  const daysUntilMartyrs = calculateDaysUntil(martyrsDate);
  if (daysUntilMartyrs >= 0 && daysUntilMartyrs <= 7) {
    upcomingHolidays.push({
      name: "Ngày Thương binh Liệt sĩ",
      tags: [
        "lịch sử",
        "chiến tranh",
        "anh hùng",
        "hy sinh",
        "tổ quốc",
        "lịch sử việt nam",
      ],
      daysUntil: daysUntilMartyrs,
    });
  }

  // Ngày Quốc khánh (2/9) - check 7 ngày trước
  let independenceDate = new Date(year, 8, 2);
  if (independenceDate < now) {
    independenceDate = new Date(year + 1, 8, 2);
  }
  const daysUntilIndependence = calculateDaysUntil(independenceDate);
  if (daysUntilIndependence >= 0 && daysUntilIndependence <= 7) {
    upcomingHolidays.push({
      name: "Chào Mừng Ngày Quốc khánh",
      tags: [
        "quốc khánh",
        "độc lập",
        "tổ quốc",
        "việt nam",
        "lịch sử",
        "dân tộc",
      ],
      daysUntil: daysUntilIndependence,
    });
  }

  // Ngày Phụ nữ Việt Nam (20/10) - check 7 ngày trước
  let vietnamWomenDate = new Date(year, 9, 20);
  if (vietnamWomenDate < now) {
    vietnamWomenDate = new Date(year + 1, 9, 20);
  }
  const daysUntilVietnamWomen = calculateDaysUntil(vietnamWomenDate);
  if (daysUntilVietnamWomen >= 0 && daysUntilVietnamWomen <= 7) {
    upcomingHolidays.push({
      name: "Chào Mừng Ngày Phụ nữ Việt Nam",
      tags: ["phụ nữ việt nam", "phụ nữ", "nữ quyền", "tôn vinh", "bình đẳng"],
      daysUntil: daysUntilVietnamWomen,
    });
  }

  // Halloween (31/10) - check 7 ngày trước
  let halloweenDate = new Date(year, 9, 31);
  if (halloweenDate < now) {
    halloweenDate = new Date(year + 1, 9, 31);
  }
  const daysUntilHalloween = calculateDaysUntil(halloweenDate);
  if (daysUntilHalloween >= 0 && daysUntilHalloween <= 7) {
    upcomingHolidays.push({
      name: "Halloween",
      tags: ["halloween", "kinh dị", "ma quỷ", "bí ẩn", "huyền bí", "giải trí"],
      daysUntil: daysUntilHalloween,
    });
  }

  // Ngày Nhà giáo Việt Nam (20/11) - check 7 ngày trước
  let teachersDate = new Date(year, 10, 20);
  if (teachersDate < now) {
    teachersDate = new Date(year + 1, 10, 20);
  }
  const daysUntilTeachers = calculateDaysUntil(teachersDate);
  if (daysUntilTeachers >= 0 && daysUntilTeachers <= 7) {
    upcomingHolidays.push({
      name: "Chào Mừng Ngày Nhà Giáo Việt Nam",
      tags: [
        "giáo dục",
        "thầy cô",
        "học tập",
        "tri thức",
        "sư phạm",
        "giáo viên",
      ],
      daysUntil: daysUntilTeachers,
    });
  }

  // Giáng sinh (25/12) - check 7 ngày trước
  let christmasDate = new Date(year, 11, 25);
  if (christmasDate < now) {
    christmasDate = new Date(year + 1, 11, 25);
  }
  const daysUntilChristmas = calculateDaysUntil(christmasDate);
  if (daysUntilChristmas >= 0 && daysUntilChristmas <= 7) {
    upcomingHolidays.push({
      name: "Giáng sinh",
      tags: [
        "giáng sinh",
        "noel",
        "christmas",
        "tặng quà",
        "yêu thương",
        "gia đình",
        "tôn giáo",
      ],
      daysUntil: daysUntilChristmas,
    });
  }

  // Đêm Giao thừa (31/12) - check 7 ngày trước
  let newYearEveDate = new Date(year, 11, 31);
  if (newYearEveDate < now) {
    newYearEveDate = new Date(year + 1, 11, 31);
  }
  const daysUntilNewYearEve = calculateDaysUntil(newYearEveDate);
  if (daysUntilNewYearEve >= 0 && daysUntilNewYearEve <= 7) {
    upcomingHolidays.push({
      name: "Đêm Giao thừa",
      tags: [
        "giao thừa",
        "năm mới",
        "countdown",
        "chúc mừng",
        "hy vọng",
        "khởi đầu",
      ],
      daysUntil: daysUntilNewYearEve,
    });
  }

  // Nếu có nhiều ngày lễ sắp tới, gộp lại
  if (upcomingHolidays.length > 0) {
    // Sắp xếp theo số ngày còn lại
    upcomingHolidays.sort((a, b) => a.daysUntil - b.daysUntil);

    // Gộp tags
    const allTags = upcomingHolidays.reduce(
      (acc, h) => [...acc, ...h.tags],
      []
    );

    // Gộp tên nếu có nhiều ngày lễ
    const holidayName =
      upcomingHolidays.length > 1
        ? upcomingHolidays.map((h) => h.name).join(" & ")
        : upcomingHolidays[0].name;

    return {
      name: holidayName,
      tags: [...new Set(allTags)],
      daysUntil: upcomingHolidays[0].daysUntil,
    };
  }

  return null;
}

module.exports = {
  getHolidayContext,
  getNearHoliday,
};
