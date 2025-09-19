# Steve's Genealogy Tool - Setup Instructions

## Overview
A comprehensive full-stack genealogy application with user registration, authentication, and GEDCOM file processing.

## Prerequisites
- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Git

## Project Setup

### 1. Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and update with your settings
cp .env.example .env

# Update the .env file with:
# - MongoDB connection string
# - Email service credentials (Gmail recommended)
# - JWT secret (generate a secure random string)
# - Encryption key (64-character hex string)

# Start the development server
npm run dev
```

### 2. Frontend Setup

```powershell
# Open new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

### 3. MongoDB Setup

#### Option 1: Local MongoDB
1. Install MongoDB Community Edition
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/genealogy-db`

#### Option 2: MongoDB Atlas (Cloud)
1. Create a free account at MongoDB Atlas
2. Create a cluster and get connection string
3. Update MONGODB_URI in backend/.env

### 4. Email Configuration

For email verification to work, configure your email service:

#### Gmail Setup:
1. Enable 2-factor authentication on your Google account
2. Generate an App Password
3. Update .env file:
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

## Running the Application

1. Start MongoDB (if running locally)
2. Start backend server: `cd backend && npm run dev`
3. Start frontend server: `cd frontend && npm start`
4. Open http://localhost:3000 in your browser

## Features Implemented

### ✅ Completed Features
- **User Registration**: With and without GEDCOM files
- **Email Verification**: 5-minute verification code system
- **Secure Authentication**: JWT tokens, password hashing
- **GEDCOM Processing**: File upload, validation, encryption
- **Responsive UI**: Bootstrap-based design
- **Database Security**: Encrypted user data storage

### 🚧 User Flow
1. **Welcome Page**: Login or register
2. **Registration**: Choose GEDCOM upload or manual entry
3. **Email Verification**: 6-digit code sent to email
4. **Genealogy Dashboard**: Basic welcome screen

### 🔮 Future Features (Planned)
- Family tree visualization
- Advanced GEDCOM parsing
- Multi-user GEDCOM sharing
- Search and reports
- Import/export features

## Technology Stack

**Backend:**
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcrypt password hashing
- Multer file uploads
- Nodemailer email service

**Frontend:**
- React 18 + JavaScript
- React Router DOM
- Bootstrap 5
- Axios for API calls
- Context API for state management

## Security Features
- Password strength validation
- Email verification required
- JWT token authentication
- Encrypted GEDCOM data storage
- Rate limiting
- CORS protection
- Helmet security headers

## File Structure
```
genealogy/
├── backend/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth & validation
│   ├── utils/           # Helper functions
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── services/    # API services
│   │   └── types/       # JavaScript type definitions
│   └── public/          # Static files
└── README.md
```

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in .env

2. **Email Not Sending**
   - Verify email credentials
   - Check Gmail app password setup
   - Look for emails in spam folder

3. **Frontend Build Errors**
   - Delete node_modules and package-lock.json
   - Run `npm install` again

4. **CORS Errors**
   - Ensure backend is running on port 5000
   - Check CLIENT_URL in backend .env

### Development Commands:

```powershell
# Backend
npm run dev         # Start with nodemon
npm start          # Production start
npm test           # Run tests (when implemented)

# Frontend  
npm start          # Development server
npm build          # Production build
npm test           # Run tests
```

## Environment Variables

### Backend (.env):
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/genealogy-db
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=30d
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ENCRYPTION_KEY=your-64-char-hex-key
CLIENT_URL=http://localhost:3000
```

## API Endpoints

### Authentication:
- `POST /api/auth/register-gedcom` - Register with GEDCOM file
- `POST /api/auth/register-first-gedcom` - Register with manual entry
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### GEDCOM:
- `GET /api/gedcom/stats` - Get database statistics
- `GET /api/gedcom/data` - Get genealogy data

### Users:
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile

## Support

For questions or issues:
1. Check the troubleshooting section
2. Review error logs in browser console and server terminal
3. Ensure all prerequisites are installed correctly

## License
MIT License - Feel free to modify and distribute.