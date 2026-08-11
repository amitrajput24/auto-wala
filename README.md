# Auto Wala — permanent music website + admin panel

## Run locally
1. Install Node.js 20+.
2. In this folder run: `npm install`
3. Set an admin password:
   - Windows PowerShell: `$env:ADMIN_PASSWORD="your-strong-password"`
   - Linux/macOS: `export ADMIN_PASSWORD="your-strong-password"`
4. Run: `npm start`
5. Open `http://localhost:3000`
6. Admin panel: `http://localhost:3000/admin/`

## Online deployment
Deploy the whole folder to a Node.js host with persistent disk/storage.
Set `ADMIN_PASSWORD` in the host's environment variables.
The `data/` directory must be on persistent storage because it contains the song database and uploaded audio.

For a real public site, use HTTPS and a strong password. This starter stores uploaded audio on the server disk. For large libraries, replace local storage with S3/R2/Supabase Storage.
