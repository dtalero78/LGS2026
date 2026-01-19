import { MongoClient, Db } from 'mongodb'
import { isDbDisabled } from './utils'

if (!process.env.MONGODB_URI && !isDbDisabled()) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lgs_admin_dev'
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

// If DB is disabled, create a mock client
if (isDbDisabled()) {
  clientPromise = Promise.resolve({} as MongoClient)
} else if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Database helper functions
export async function getDatabase(): Promise<Db> {
  if (isDbDisabled()) {
    // Return a mock DB object when DB is disabled
    return {} as Db
  }
  const client = await clientPromise
  return client.db('lgs_admin')
}

export async function connectToDatabase() {
  if (isDbDisabled()) {
    // Return mock objects when DB is disabled
    return { client: {} as MongoClient, db: {} as Db }
  }

  try {
    const client = await clientPromise
    const db = client.db('lgs_admin')
    return { client, db }
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
}

export default clientPromise