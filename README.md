# Concertina HRIS

This project is a Next.js HRIS app backed by Prisma and PostgreSQL.

## Local Setup

1. Create a local env file from the checked-in example.

```bash
cp .env.example .env.local
```

2. Fill in the required values in `.env.local`.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
RESEND_API_KEY=""
PASSWORD_RESET_EMAIL_FROM="Concertina HR <no-reply@themediamorphosys.com>"
NOTIFICATION_EMAIL_FROM="Concertina HR <notifications@themediamorphosys.com>"
NODE_ENV="development"
```

3. Install dependencies.

```bash
npm install
```

4. Run Prisma migrations.

```bash
npx prisma migrate dev
```

5. Start the development server.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `DATABASE_URL`: Primary PostgreSQL connection string used by Prisma.
- `DIRECT_URL`: Direct PostgreSQL connection string for Prisma migrations.
- `NEXTAUTH_URL`: Base URL used by NextAuth. Use `http://localhost:3000` locally and the public deployed domain in production.
- `NEXT_PUBLIC_APP_URL`: Public app URL used for setup-account, password-reset, and notification email links. Set this to the deployed domain in production so email links do not point to localhost.
- `NEXTAUTH_SECRET`: Secret used to sign NextAuth sessions and tokens.
- `RESEND_API_KEY`: Resend API key used for invite, password reset, and notification emails.
- `PASSWORD_RESET_EMAIL_FROM`: Sender address for password reset emails.
- `NOTIFICATION_EMAIL_FROM`: Sender address for invite and notification emails.
- `NODE_ENV`: App environment, usually `development` for local work.

## Production URL Setup

Before sending real invite or password reset emails, update the app URL values in the deployed environment:

```env
NEXTAUTH_URL="https://your-production-domain.com"
NEXT_PUBLIC_APP_URL="https://your-production-domain.com"
```

If these remain set to `http://localhost:3000`, new employee setup links and password reset links will open the local development server instead of the live app.

## Notes

- The real `.env` and `.env.local` files are intentionally ignored by git.
- Commit `.env.example`, not the actual secret values.
