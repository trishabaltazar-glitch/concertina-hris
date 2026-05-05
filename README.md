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
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
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
- `NEXTAUTH_URL`: Base URL used when generating auth and invite links.
- `NEXTAUTH_SECRET`: Secret used to sign NextAuth sessions and tokens.
- `NODE_ENV`: App environment, usually `development` for local work.

## Notes

- The real `.env` and `.env.local` files are intentionally ignored by git.
- Commit `.env.example`, not the actual secret values.
