# POS Instructions

## Development

To start the development server:

```bash
npm run dev
```

## Database Migrations

When the database schema (`prisma/schema.prisma`) is changed, you **MUST** run the following command to apply those changes to your local database:

```bash
npx prisma migrate dev
```

This will create a new migration file and update your database structure. You may be prompted to give the migration a name.

### Other Useful Database Commands

- **Seed Database:** To populate the database with initial sample data (customers, products, etc.).
  ```bash
  npx prisma db seed
  ```

- **Reset and Seed:** To completely reset the database and re-apply all seeds. **Warning: This will delete all existing data.**
  ```bash
  npx prisma migrate reset
  ```

- **Open Prisma Studio:** To view and edit your database in a web browser.
  ```bash
  npx prisma studio
  ```
hi