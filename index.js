const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./src/app');
const port = process.env.PORT || 5000;

async function main() {
  await mongoose.connect(process.env.DB_URL);
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

main()
  .then(() => console.log("Mongodb connect successfully!"))
  .catch(err => console.log(err));
