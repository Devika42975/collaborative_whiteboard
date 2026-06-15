# Collaborative Whiteboard Frontend

Vite + React frontend for the collaborative whiteboard app.

## Local Development

1. Install dependencies:

```powershell
npm install
```

2. Start the dev server:

```powershell
npm run dev
```

## Deployment

This frontend is designed to run on Vercel and talk to the backend hosted on Render.

Set these environment variables in Vercel for the frontend project:

- `VITE_API_BASE_URL` - your backend API URL, for example `https://your-backend.onrender.com/api`
- `VITE_SOCKET_URL` - your backend socket URL, for example `https://your-backend.onrender.com`

On the Render backend, set:

- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN` - your Vercel frontend URL, for example `https://your-frontend.vercel.app`

The backend reads `PORT` from the hosting platform automatically, so it should not be hardcoded for Render.

## Notes

- The frontend code reads the API and socket URLs from `import.meta.env`.
- If those variables are missing in production, the app will fall back to local `localhost` URLs, which will not work after deployment.
- Keep the placeholder values in `.env.example` updated when changing hosting URLs.
