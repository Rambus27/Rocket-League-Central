# Upload Fix - "Failed to fetch" CORS Issue

**Diagnosis:** CORS preflight blocked in Codespaces (origin mismatch localhost:3000 vs Codespaces port).

## Plan Steps (Approved):

- [x] 1. Update project/backend/server.js (CORS + MongoDB)
- [x] 2. Restart server  
- [x] 3. Install ffmpeg
- [ ] 4. Test upload.html with small video + @discord  
- [ ] 5. Verify dashboard clips load

**Notes:**  
- Server PID 21653  
- ffmpeg now installed  
- MongoDB local may fail (no mongod), but uploads work with memory? Test CORS fix.

**Status:** Ready for user test!

**Test:** Open upload.html → @discord + small video → Launch Clip (check browser Network tab).

**Next:** Step 1 complete after edits.
