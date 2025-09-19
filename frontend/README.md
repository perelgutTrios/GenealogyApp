# Frontend - React.js Genealogy Application

A modern, responsive genealogy application frontend built with React.js, Bootstrap 5, and comprehensive state management for family tree data visualization and user interaction.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   ├── contexts/        # React context providers
│   ├── services/        # API service layer
│   ├── types/           # Type definitions and interfaces
│   ├── App.js          # Main application component
│   ├── App.css         # Global styles and themes
│   └── index.js        # Application entry point
├── public/             # Static assets
├── package.json        # Dependencies and scripts
└── .gitignore         # Frontend-specific ignore rules
```

## 📋 File Descriptions

### Core Application
- **`src/index.js`** - Application entry point, renders App component with React DOM
- **`src/App.js`** - Main application with routing, authentication, and protected routes
- **`src/App.css`** - Global styles, genealogy theme, Bootstrap customizations

### Components (`src/components/`)
- **`WelcomePage.js`** - Landing page with login form and registration options
- **`RegisterPage.js`** - User registration with GEDCOM upload or manual entry options
- **`UserVerify.js`** - Email verification page with 6-digit code input
- **`FirstGedcom.js`** - Manual first genealogy entry form for new users
- **`GenEntry.js`** - Main genealogy dashboard showing family tree statistics
- **`LoadingSpinner.js`** - Reusable loading component for async operations

### Contexts (`src/contexts/`)
- **`AuthContext.js`** - Global authentication state management and user session

### Services (`src/services/`)
- **`api.js`** - Centralized API service layer with axios configuration and error handling

### Types (`src/types/`)
- **`index.js`** - TypeScript-style type definitions and interfaces (commented for JavaScript)

## 🔄 Control Flow

### 1. Application Initialization Flow
```
App Start → Auth Check → Route Resolution → Component Render
```

**Detailed Steps:**
1. **App Bootstrap** - `index.js` renders App component
2. **Authentication Check** - `AuthContext` validates stored JWT token
3. **Route Protection** - `ProtectedRoute` and `PublicRoute` components manage access
4. **Component Rendering** - Appropriate component rendered based on auth state

### 2. User Registration Flow
```
Registration Form → Validation → API Call → Verification → Dashboard
```

**Detailed Steps:**
1. **Form Selection** - User chooses GEDCOM upload or manual entry
2. **Input Validation** - Client-side validation for all fields
3. **API Submission** - Form data sent to backend (with file if applicable)
4. **Verification Process** - Navigate to email verification page
5. **Success Redirect** - Auto-login and redirect to genealogy dashboard

### 3. Authentication Flow
```
Login Form → Credential Validation → Token Storage → Protected Route Access
```

**Detailed Steps:**
1. **Login Submission** - Email/password sent to backend
2. **Token Management** - JWT stored in localStorage on success
3. **Context Update** - AuthContext updates global state
4. **Route Navigation** - Automatic redirect to genealogy dashboard
5. **API Authorization** - Token included in all subsequent requests

### 4. Data Flow Architecture
```
User Interaction → Component State → API Service → Backend → Database
                     ↓
Component Update ← State Management ← API Response ← Processing ← Query
```

## 🗄️ Data Structures

### Authentication State
```javascript
// AuthContext State
{
  user: {
    _id: String,
    email: String,
    givenNames: String,
    familyNames: String,
    isVerified: Boolean,
    gedcomDatabaseId: String,
    hasGedcomFile: Boolean,
    createdAt: String,
    lastLogin: String
  },
  token: String (JWT),
  isAuthenticated: Boolean,
  isLoading: Boolean
}
```

### Registration Form Data
```javascript
// GEDCOM Upload Registration
{
  email: String,
  password: String,
  confirmPassword: String,
  givenNames: String,
  familyNames: String,
  gedcomFile: File
}

// First Entry Registration
{
  email: String,
  password: String,
  confirmPassword: String,
  givenNames: String,
  familyNames: String,
  birthDate: String (ISO date),
  birthCity: String
}
```

### GEDCOM Statistics Display
```javascript
{
  databaseId: String,
  version: String,
  sourceFile: String,
  totalIndividuals: Number,
  totalFamilies: Number,
  lastModified: String (ISO date),
  createdAt: String (ISO date)
}
```

### API Error Structure
```javascript
{
  message: String (user-friendly error message),
  errors: Array (detailed validation errors),
  status: Number (HTTP status code)
}
```

## 🎨 User Interface Architecture

### Design System
- **Color Scheme** - Custom genealogy theme with earth tones
- **Typography** - Bootstrap typography with custom font hierarchy
- **Iconography** - Bootstrap Icons for consistent visual language
- **Layout** - Responsive grid system with mobile-first approach

### Component Hierarchy
```
App
├── AuthProvider (Context)
├── Router
└── Routes
    ├── PublicRoute (Wrapper)
    │   ├── WelcomePage
    │   ├── RegisterPage
    │   ├── UserVerify
    │   └── FirstGedcom
    └── ProtectedRoute (Wrapper)
        └── GenEntry
```

### State Management Strategy
- **Global State** - Authentication via React Context
- **Local State** - Component-specific data with useState
- **Form State** - Controlled components with validation
- **API State** - Loading, error, and success states

## 🔐 Security Implementation

### Frontend Security Measures
1. **Input Validation** - Client-side validation for all forms
2. **XSS Protection** - Proper data sanitization and escaping
3. **Token Management** - Secure JWT storage and automatic cleanup
4. **Route Protection** - Authentication-based route access control
5. **HTTPS Enforcement** - Secure transport in production

### Authentication Security
- **JWT Storage** - localStorage with automatic cleanup on logout
- **Token Expiration** - Automatic logout on token expiry
- **Request Interceptors** - Automatic token inclusion in API calls
- **Response Interceptors** - Automatic logout on 401 responses

## 📱 Responsive Design

### Breakpoint Strategy
- **Mobile First** - Base styles for mobile devices
- **Tablet** - Enhanced layouts for medium screens
- **Desktop** - Full-featured layouts for large screens
- **Wide Screen** - Optimized for ultra-wide displays

### Component Responsiveness
- **Navigation** - Collapsible navbar for mobile
- **Forms** - Stack vertically on small screens
- **Cards** - Fluid width with maximum constraints
- **Typography** - Responsive font sizing

## 🔄 Component Communication

### Data Flow Patterns
1. **Props Down** - Parent components pass data to children
2. **Events Up** - Child components communicate via callbacks
3. **Context API** - Global state for authentication
4. **Custom Hooks** - Reusable state logic (useAuth)

### API Integration Pattern
```javascript
// Typical API Integration Flow
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const fetchData = async () => {
  try {
    setLoading(true);
    const response = await apiService.getData();
    setData(response);
  } catch (err) {
    setError(handleApiError(err).message);
  } finally {
    setLoading(false);
  }
};
```

## 🎯 User Experience Features

### Loading States
- **Spinner Components** - Visual feedback during async operations
- **Skeleton Loading** - Placeholder content while data loads
- **Progressive Enhancement** - Core functionality works without JavaScript

### Error Handling
- **User-Friendly Messages** - Clear, actionable error messages
- **Validation Feedback** - Real-time form validation
- **Network Error Recovery** - Graceful handling of network issues
- **Fallback UI** - Error boundaries for component failures

### Accessibility Features
- **Semantic HTML** - Proper heading hierarchy and landmarks
- **ARIA Labels** - Screen reader support for interactive elements
- **Keyboard Navigation** - Full keyboard accessibility
- **Color Contrast** - WCAG compliant color combinations

## 🚀 API Service Layer

### Axios Configuration
```javascript
// Base API Setup
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Request Interceptor (Token Injection)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response Interceptor (Auth Error Handling)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Auto-logout on authentication failure
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);
```

### Service Methods
- **authService** - Registration, login, logout, user management
- **gedcomService** - GEDCOM data retrieval and statistics
- **handleApiError** - Centralized error processing

## 🎨 Styling Architecture

### CSS Organization
```css
/* Global Styles Hierarchy */
:root { /* CSS Custom Properties */ }
body { /* Base Typography */ }
.genealogy-theme { /* Theme Variables */ }
.component-specific { /* Component Styles */ }
.utility-classes { /* Helper Classes */ }
```

### Bootstrap Customization
- **Custom Color Palette** - Genealogy-themed primary colors
- **Component Overrides** - Customized buttons, forms, cards
- **Utility Extensions** - Additional spacing and typography utilities

## 🏃‍♂️ Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Create .env.local for local environment variables
   echo "REACT_APP_API_URL=http://localhost:5000/api" > .env.local
   ```

3. **Start Development Server**
   ```bash
   npm start
   # Application runs on http://localhost:3000
   ```

4. **Build for Production**
   ```bash
   npm run build
   # Creates optimized production build
   ```

## 📊 Performance Optimizations

### React Optimizations
- **Lazy Loading** - Code splitting for route components
- **Memoization** - React.memo for expensive components
- **Efficient Renders** - Proper dependency arrays in useEffect
- **Bundle Splitting** - Separate vendor and application bundles

### Network Optimizations
- **API Caching** - Intelligent caching of genealogy data
- **Request Debouncing** - Prevent excessive API calls
- **Error Boundaries** - Prevent cascading failures
- **Progressive Loading** - Load critical content first

## 🧪 Development Tools

### Available Scripts
- `npm start` - Development server with hot reload
- `npm run build` - Production build optimization
- `npm test` - Run test suite (future implementation)
- `npm run eject` - Eject from Create React App (if needed)

### Development Features
- **Hot Reload** - Instant updates during development
- **Error Overlay** - Development error display
- **Source Maps** - Debugging support
- **ESLint Integration** - Code quality enforcement