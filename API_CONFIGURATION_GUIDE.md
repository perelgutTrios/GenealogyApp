# 🔑 API Configuration Guide for AI-Enhanced Genealogy Search

This guide will help you configure all the necessary API keys to unlock the full potential of your AI-enhanced genealogy research tool.

## 🎯 **Quick Start Priority List**

### **ESSENTIAL (Get These First)**
1. ✅ **OpenAI API** - Core AI features
2. ✅ **FamilySearch API** - Largest free database

### **RECOMMENDED (Add These Next)**  
3. 🔄 **WikiTree API** - Free collaborative database
4. 🔄 **Chronicling America** - Free newspaper archives

### **OPTIONAL (Premium Features)**
5. 💰 **BillionGraves API** - Cemetery records
6. 💰 **MyHeritage API** - Additional records

---

## 🧠 **1. AI Provider (Choose One: Gemini FREE or OpenAI)**

You can use Google Gemini (free tier available) or OpenAI. If both keys are set, the backend prefers Gemini to help you stay within a free tier during development.

### Option A: Google Gemini (Recommended Free Tier)
1. Go to https://ai.google.dev/ and open AI Studio
2. Create an API key
3. Add to your backend `.env`:

```env
GEMINI_API_KEY=your_gemini_key_here
```

### Option B: OpenAI

**Purpose**: Powers GPT-4 for intelligent search query generation and record analysis

### **How to Get It:**
1. 🌐 Go to [platform.openai.com](https://platform.openai.com)
2. 📝 Sign up or log in to your account
3. 🔑 Navigate to **"API Keys"** in the left sidebar
4. ➕ Click **"Create new secret key"**
5. 🏷️ Name it: `"Genealogy-AI-Research"`
6. 📋 Copy the key immediately (starts with `sk-proj-`)
7. ⚠️ **IMPORTANT**: Save it securely - you won't see it again!

### **Configuration:**
```env
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=sk-proj-abc123def456...your_actual_key_here
```

### **Cost Estimate:**
- 💰 **Pay-per-use**: ~$0.03-$0.06 per 1,000 tokens
- 📊 **Monthly budget**: $10-20 for moderate use (100-200 searches/month)
- 🎛️ **Cost control**: Set usage limits in OpenAI dashboard

### **Test Connection:**
```bash
# Test in terminal (replace YOUR_KEY)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY"
```

---

## 📚 **2. FamilySearch API (FREE & HIGHLY RECOMMENDED)**

**Purpose**: Access to world's largest collection of free genealogical records (4+ billion names)

### **How to Get It:**
1. 🌐 Go to [developers.familysearch.org](https://developers.familysearch.org)
2. 📝 Create a **developer account** (completely free)
3. 📱 Click **"Register a New App"**
4. 📋 Fill in the application form:
   ```
   App Name: My Genealogy Research Tool
   Description: Personal genealogy research application with AI enhancement
   Callback URL: http://localhost:5000/auth/familysearch/callback
   Scopes: Read access to genealogical records
   ```
5. ✅ Submit and wait for approval (usually instant)
6. 📋 Copy your **Client ID** and **Client Secret**

### **Configuration:**
```env
FAMILYSEARCH_CLIENT_ID=your_actual_client_id_here
FAMILYSEARCH_CLIENT_SECRET=your_actual_client_secret_here
```

### **Benefits:**
- 🆓 **Completely FREE**
- 📊 **4+ billion historical records**
- 🌍 **Global coverage** (not just US)
- 🔄 **Active updates** from community contributions

---

## 🌳 **3. WikiTree API (FREE)**

**Purpose**: Collaborative family tree database with 30+ million profiles

### **How to Get It:**
1. 🌐 Go to [WikiTree.com](https://www.wikitree.com)
2. 📝 Create a free account
3. 📖 Read the [API documentation](https://github.com/wikitree/wikitree-api)
4. 🎉 **No API key required** for basic searches!

### **Configuration:**
```env
WIKITREE_API_KEY=no_key_required
WIKITREE_API_BASE=https://api.wikitree.com/api.php
```

### **Benefits:**
- 🆓 **Completely FREE**
- 👥 **Collaborative platform** with verified profiles
- 🔗 **Connected family trees**
- 📝 **Detailed biographical information**

---

## 📰 **4. Chronicling America (FREE - Library of Congress)**

**Purpose**: Historical newspaper archives (1777-1963) for obituaries and life events

### **How to Get It:**
1. 🎉 **No registration required!**
2. 📖 Public API from Library of Congress
3. 🌐 Base URL: `https://chroniclingamerica.loc.gov`

### **Configuration:**
```env
CHRONICLING_AMERICA_API_BASE=https://chroniclingamerica.loc.gov
NEWSPAPERS_API_KEY=free_access_no_key_required
```

### **Benefits:**
- 🆓 **Completely FREE**
- 📰 **Millions of historical newspapers**
- 🏛️ **Government maintained** (reliable)
- 📅 **Historical coverage** (1777-1963)

---

## ⚰️ **5. BillionGraves API (PREMIUM)**

**Purpose**: Cemetery records and burial information (alternative to FindAGrave)

### **How to Get It:**
1. 🌐 Go to [BillionGraves.com](https://billiongraves.com)
2. 📝 Create an account
3. 📧 Contact their support for API access
4. 💰 Pricing varies based on usage

### **Configuration:**
```env
BILLIONGRAVES_API_KEY=your_api_key_here
```

### **Alternative (FREE):**
- Use **FindAGrave web scraping** (check their ToS)
- Manual search integration through their website

---

## 🌍 **6. MyHeritage API (CONTACT REQUIRED)**

**Purpose**: International genealogical records and family trees

### **How to Get It:**
1. 🌐 Go to [MyHeritage.com](https://www.myheritage.com)
2. 📧 Contact their business development team
3. 📝 Explain your use case and application
4. 💰 Negotiate API access and pricing

### **Configuration:**
```env
MYHERITAGE_API_KEY=contact_required
```

---

## ⚡ **Quick Configuration Steps**

### **Step 1: Update Your .env File**
Open `backend/.env` and replace the placeholder values:

```env
# ESSENTIAL APIs
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=sk-proj-your_actual_openai_key_here
FAMILYSEARCH_CLIENT_ID=your_actual_familysearch_client_id
FAMILYSEARCH_CLIENT_SECRET=your_actual_familysearch_secret

# FREE APIs (No keys needed)
WIKITREE_API_KEY=no_key_required
CHRONICLING_AMERICA_API_BASE=https://chroniclingamerica.loc.gov

# OPTIONAL PREMIUM APIs
BILLIONGRAVES_API_KEY=your_billiongraves_key_here
MYHERITAGE_API_KEY=contact_myheritage_required
```

### **Step 2: Test Your Configuration**
```bash
cd backend
npm start
```

### **Step 3: Verify in Application**
1. 🖥️ Start your frontend: `cd frontend && npm start`
2. 🧪 Try the AI Search Panel
3. 🔍 Generate search queries to test OpenAI integration
4. 🌐 Run external searches to test FamilySearch

---

## 🚨 **Important Security Notes**

### **Protect Your API Keys:**
- ❌ **Never commit** `.env` files to git
- ✅ **Use environment variables** in production
- 🔒 **Rotate keys** regularly
- 📝 **Monitor usage** to detect unauthorized access

### **Rate Limiting:**
- 🚦 **OpenAI**: 60 requests/minute (Tier 1)
- 🚦 **FamilySearch**: 40,000 requests/day (free tier)
- 🚦 **WikiTree**: 10 requests/second
- 🚦 **Chronicling America**: No official limits (be respectful)

---

## 🎯 **Success Metrics**

After configuration, you should see:

✅ **OpenAI Integration**: 
- Intelligent search queries generated
- AI analysis of record matches
- Natural language explanations

✅ **FamilySearch Integration**:
- Real genealogical records returned
- Historical documents and images
- Family relationship connections

✅ **Free Sources Working**:
- WikiTree collaborative profiles
- Newspaper archive searches
- No API errors in console

---

## 🆘 **Troubleshooting**

### **Common Issues:**

**1. OpenAI "Invalid API Key"**
- ✅ Check key starts with `sk-proj-`
- ✅ Verify no extra spaces in `.env`
- ✅ Confirm account has billing set up

**2. FamilySearch "Unauthorized"**
- ✅ Verify Client ID and Secret are correct
- ✅ Check callback URL matches registration
- ✅ Ensure app is approved by FamilySearch

**3. "Module not found" errors**
- ✅ Run `npm install` in backend directory
- ✅ Check all dependencies in `package.json`

**4. CORS errors**
- ✅ Verify `CLIENT_URL=http://localhost:3000` in `.env`
- ✅ Check frontend is running on port 3000

---

## 📞 **Need Help?**

If you encounter issues:

1. 📋 **Check the console logs** for specific error messages
2. 🔍 **Verify API key format** and permissions
3. 📖 **Review API documentation** for any changes
4. 🧪 **Test with minimal examples** first
5. 💬 **Contact API support** if keys aren't working

---

## 🎉 **You're Ready!**

Once you have at least **OpenAI** and **FamilySearch** configured, your AI genealogy search will be fully functional with:

- 🤖 **Intelligent query generation**
- 🔍 **Multi-source searching**
- 📊 **Confidence scoring**
- 🧠 **AI-powered analysis**
- 📱 **Beautiful user interface**

Happy researching! 🌳✨