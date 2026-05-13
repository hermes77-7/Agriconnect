# Setup Guide

## Backend (C++)

Run `msys2-20251213-installer` to install msys  
Once the terminal opens run the command `pacman -Syu`  
Once the terminal closes open the MSYS2 UCTR64 terminal and run `pacman -Syu`  
Close it then open MSYS2 MINGW64 and run `pacman -Syu`  
Then once that is done run the commands:

- `pacman -S mingw-w64-x86_64-gcc`
- `pacman -S mingw-w64-x86_64-cmake`
- `pacman -S mingw-w64-x86_64-postgresql`

Once installed in that same terminal go to the cpp-backend build folder for example run  
`cd /c/Users/youruser/Desktop/Agriconnect/cpp-backend/build`

Then run the command  
`./agriconnect_backend.exe` (to start the backend server)

Your backend server should run


---

## Frontend (React Native)

Go to the frontend path in any terminal. For example run  
`cd C:\Users\youruser\Desktop\Agriconnect\mobile`

Then run:

- `npm install`
- `npx expo start` (to start the frontend server)


---

## .env file

Create a file named `.env` in `cpp-backend`

### Format:

```env
DB_HOST=YOURHOST
DB_USER=YOURUSER
DB_PASSWORD=YOURPASSWORD
DB_NAME=YOURDATABASENAME
DB_PORT=YOURPORT (usually 5432)
JWT_SECRET=agriconnect_super_secret_key_2026 (don’t change this)

---

## NB

The database should be ready prior to building the backend