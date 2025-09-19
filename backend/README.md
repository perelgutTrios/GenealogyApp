# Backend - Node.js/Express API Server

A secure genealogy application backend built with Node.js, Express, MongoDB, and comprehensive authentication and data encryption.

## 📁 Project Structure

```
backend/
├── middleware/           # Express middleware functions
├── models/              # MongoDB/Mongoose data models
├── routes/              # API route handlers
├── scripts/             # Utility and maintenance scripts
├── utils/               # Helper functions and utilities
├── server.js            # Main application entry point
├── package.json         # Dependencies and scripts
└── .env.example         # Environment variables template
```

## 📋 File Descriptions

### Core Application
- **`server.js`** - Main Express server setup with middleware, routes, and MongoDB connection
- **`package.json`** - Project dependencies, scripts, and metadata
- **`.env.example`** - Template for environment variables (JWT secrets, MongoDB URI, email config)

### Middleware (`middleware/`)
- **`auth.js`** - JWT authentication middleware and user verification checks

### Models (`models/`)
- **`User.js`** - User account schema with encrypted fields and authentication methods
- **`Gedcom.js`** - GEDCOM database schema for storing encrypted genealogy data

### Routes (`routes/`)
- **`auth.js`** - Authentication endpoints (register, login, verify, logout)
- **`gedcom.js`** - GEDCOM data endpoints (stats, data retrieval)
- **`users.js`** - User management endpoints

### Utilities (`utils/`)
- **`helpers.js`** - Encryption, validation, and utility functions
- **`emailService.js`** - Email sending service for verification codes
- **`gedcomParser.js`** - GEDCOM file parsing and data extraction

### Scripts (`scripts/`)
- **`reparseGedcom.js`** - Maintenance script to reparse existing GEDCOM data

## 🔄 Control Flow

### 1. User Registration Flow
```
User Registration → Validation → Email Verification → GEDCOM Processing → Account Creation
```

**Detailed Steps:**
1. **Registration Request** (`/api/auth/register-gedcom` or `/api/auth/register-first-gedcom`)
   - Validates user input (email, password, names)
   - Checks for existing users
   - Generates verification code
2. **Email Verification** - Sends 6-digit code via Nodemailer
3. **Temporary Data Storage** - Stores registration data in user document
4. **Verification Process** (`/api/auth/verify-email`)
   - Validates verification code and expiration
   - Processes GEDCOM data (parsing or first entry creation)
   - Encrypts genealogy data using AES-256
   - Creates GEDCOM database record
   - Generates JWT token

### 2. Authentication Flow
```
Login Request → Credential Validation → JWT Generation → Protected Route Access
```

**Detailed Steps:**
1. **Login** (`/api/auth/login`) - Validates email/password with bcrypt
2. **JWT Generation** - Creates signed token with user ID
3. **Middleware Protection** - `authMiddleware` validates JWT on protected routes
4. **User Context** - Adds user object to request for route handlers

### 3. GEDCOM Data Flow
```
File Upload → Parsing → Encryption → Database Storage → Decryption → API Response
```

**Detailed Steps:**
1. **File Upload** - Multer handles multipart/form-data with validation
2. **GEDCOM Parsing** - Custom parser extracts individuals and families
3. **Data Encryption** - AES-256-CBC encryption with user-specific keys
4. **Database Storage** - Encrypted JSON stored in MongoDB
5. **Retrieval** - Data decrypted on-demand for API responses

## 🗄️ Data Structures

### User Model
```javascript
{
  _id: ObjectId,
  email: String (unique, validated),
  password: String (bcrypt hashed),
  givenNames: String,
  familyNames: String,
  isVerified: Boolean,
  verificationCode: String (6-digit, expires in 5min),
  verificationExpires: Date,
  gedcomDatabaseId: String (unique),
  encryptionKey: String (32-byte hex),
  hasGedcomFile: Boolean,
  tempRegistrationData: Mixed (stores temp data during verification),
  createdAt: Date,
  lastLogin: Date
}
```

### GEDCOM Database Model
```javascript
{
  _id: ObjectId,
  databaseId: String (unique identifier),
  userId: ObjectId (reference to User),
  encryptedData: String (JSON containing encrypted genealogy data),
  sourceFile: String (original filename),
  gedcomVersion: String,
  totalIndividuals: Number,
  totalFamilies: Number,
  createdAt: Date,
  lastModified: Date
}
```

### Encrypted GEDCOM Data Structure
```javascript
{
  individuals: [
    {
      id: String (e.g., "I1", "I2"),
      givenNames: String,
      familyNames: String,
      birthDate: String,
      birthPlace: String,
      deathDate: String,
      deathPlace: String,
      sex: String ("M", "F", "U")
    }
  ],
  families: [
    {
      id: String (e.g., "F1", "F2"),
      husband: String (individual ID),
      wife: String (individual ID),
      children: [String] (array of individual IDs),
      marriageDate: String,
      marriagePlace: String
    }
  ],
  sourceFile: String,
  importDate: Date,
  rawGedcom: String (original GEDCOM content),
  parseSuccess: Boolean,
  parseError: String
}
```

## 🔐 Security Architecture

### Encryption Strategy
- **User Encryption Keys** - Each user has a unique 32-byte encryption key
- **AES-256-CBC** - Industry-standard encryption for genealogy data
- **Password Security** - bcrypt with 12 salt rounds
- **JWT Tokens** - Signed tokens with configurable expiration

### Data Protection Layers
1. **Transport Security** - HTTPS in production
2. **Authentication** - JWT-based with middleware validation
3. **Authorization** - User-specific data access only
4. **Encryption** - All genealogy data encrypted at rest
5. **Input Validation** - express-validator for all inputs
6. **Rate Limiting** - Protection against brute force attacks

## 📊 Database Schema

### MongoDB Collections

#### `users` Collection
- **Primary Key:** `_id` (ObjectId)
- **Unique Indexes:** `email`, `gedcomDatabaseId`
- **Encrypted Fields:** Password (bcrypt), genealogy data keys
- **Relationships:** One-to-One with `gedcomdatabases`

#### `gedcomdatabases` Collection
- **Primary Key:** `_id` (ObjectId)
- **Unique Indexes:** `databaseId`
- **Foreign Keys:** `userId` (references users._id)
- **Encrypted Fields:** `encryptedData` (contains all genealogy information)
- **Indexes:** `userId`, `databaseId`, `createdAt`

### Relationships
```
User (1) ←→ (1) GedcomDatabase
├── User stores encryption key
├── GedcomDatabase stores encrypted genealogy data
└── Bidirectional relationship via userId
```

## 🚀 API Endpoints

### Authentication Routes (`/api/auth/`)
- `POST /register-gedcom` - Register with GEDCOM file upload
- `POST /register-first-gedcom` - Register with manual first entry
- `POST /verify-email` - Verify email with 6-digit code
- `POST /login` - User login with email/password
- `GET /me` - Get current user information
- `POST /logout` - User logout

### GEDCOM Routes (`/api/gedcom/`)
- `GET /stats` - Get GEDCOM database statistics
- `GET /data` - Get decrypted genealogy data

### User Routes (`/api/users/`)
- User management endpoints (future implementation)

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/genealogy-db

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=30d

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Security
ENCRYPTION_KEY=your-64-character-encryption-key

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

## 🏃‍♂️ Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running locally
   # Or configure MONGODB_URI for remote database
   ```

4. **Start Server**
   ```bash
   npm start
   # Server runs on http://localhost:5000
   ```

## 🧪 Maintenance Scripts

### Reparse GEDCOM Data
```bash
node scripts/reparseGedcom.js
```
Updates existing GEDCOM records with improved parsing logic.

## 📈 Performance Considerations

- **Lazy Loading** - GEDCOM data decrypted only when requested
- **Efficient Parsing** - Streaming GEDCOM parser for large files
- **Database Indexing** - Optimized queries with proper indexes
- **Rate Limiting** - Prevents API abuse and DoS attacks
- **Memory Management** - Temporary data cleanup after verification