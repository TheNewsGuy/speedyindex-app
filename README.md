# SpeedyIndex Press Release URL Indexer

## User Accounts

The system is password protected. Use one of these accounts to login:

### Account 1 - Administrator
- **Username:** admin
- **Password:** SpeedyAdmin2024!

### Account 2 - Manager
- **Username:** manager  
- **Password:** IndexManager#123

### Account 3 - Staff
- **Username:** staff
- **Password:** PressRelease@456

## Quick Start Guide

### 🚀 Access the Tool
1. Visit: **[Your Netlify URL will be here after deployment]**
2. Login with one of the accounts above
3. Your session stays active for 24 hours

### 📊 How to Use
1. **Login** with your username and password
2. **Export your press release report** from your distribution service as Excel (.xls or .xlsx)
3. **Drag and drop** your Excel file onto the upload area (or click to browse)
4. Click **"Submit to SpeedyIndex"**
5. Watch the progress bar - it processes URLs in batches
6. When complete, click **"Export Results"** to download a CSV report

### 📋 Excel File Requirements
- URLs must be in **Column B**
- Site names should be in **Column A** (optional but recommended)
- No special formatting needed
- File can contain up to 1000 URLs

### ✅ Understanding Results
- **Green checkmark** = Successfully indexed
- **Red X** = Failed to index (check the error message)
- The tool shows remaining SpeedyIndex credits

### 🔒 Security Features
- Password protected access
- Sessions expire after 24 hours
- API key is secured server-side
- All submissions are logged with username

### 🆘 Troubleshooting

**"Invalid username or password" error:**
- Check your credentials (passwords are case-sensitive)
- Contact administrator for password reset

**"Session expired" message:**
- Your login session expired after 24 hours
- Simply login again to continue

**"No URLs found" error:**
- Ensure URLs are in Column B of your Excel file
- URLs must start with http:// or https://

**Processing seems stuck:**
- Large files (400+ URLs) may take 2-3 minutes
- Don't close the browser tab while processing

### 💡 Pro Tips
1. Save your login in your browser's password manager
2. Process files with 100-200 URLs at a time for best performance
3. Export results immediately after processing for your records
4. Check the credit balance shown after processing

---

## For Administrators

### Managing User Accounts

To change passwords or add users:

1. Edit `netlify/functions/auth.js`
2. Update the users object with new credentials
3. Passwords are hashed using SHA256
4. Push changes to GitHub for auto-deployment

### Viewing Activity Logs

Check Netlify Functions logs to see:
- Who logged in and when
- Which user processed URLs
- Success/failure rates by user

### API Key Management

The SpeedyIndex API key is secured server-side. To update:

1. Go to Netlify → Site settings → Environment variables
2. Set: `SPEEDYINDEX_API_KEY = your-new-key`
3. Redeploy the site

### Security Notes
- Passwords are hashed before storage
- Tokens expire after 24 hours
- All API calls require authentication
- Consider using environment variables for passwords in production
