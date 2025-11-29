const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function closeDatabase() {
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) await mongod.stop();
}

module.exports = { connect, clearDatabase, closeDatabase };
