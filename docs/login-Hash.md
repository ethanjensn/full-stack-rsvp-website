## How the password is stored safely

The `users` table stores a hash, not the actual password. A hash is a one-way value created by running the password through a math function. You can turn `password` into a hash, but you cannot turn the hash back into `password`.

### Example

A stored hash looks like this:

```
pbkdf2:sha256:600000$abc$xyz
```

Breaking that down:

- `pbkdf2` — the recipe used.
- `sha256` — the hash function inside the recipe.
- `600000` — how many times the math is repeated.
- `abc` — a random **salt** for this user.
- `xyz` — the final hash.

### How the salt works

Each admin user gets their own random salt. If two users picked the same password, their stored hashes would still look different because their salts are different. The salt is stored in the hash string, so it is not a secret. It just makes pre-computed password lists useless against your database.

### How the login check works

When you type your password and click **Log In**:

1. The server receives the plain text password.
2. It reads the stored hash from the `users` table.
3. It extracts the salt and the number of rounds from that hash.
4. It runs your typed password through the same math with the same salt and rounds.
5. It compares the new result to the stored `xyz`.
6. If they match, the password was correct.

The password is never written to the database, and the plain text only lives in server memory for a split second during the login request.

### Why it is one-way

SHA-256 is designed to destroy information while it runs. It breaks the password into pieces, mixes them, and throws away bits during 600,000 rounds. Because information is lost, there is no reverse formula. The only way to find the password from the hash is to guess, and the 600,000 rounds make each guess very slow.

## Changing the admin password later

There is no admin-management page yet. To change the password, update the `password_hash` value directly in the `users` table in Neon, or generate a new hash in Python and run an `UPDATE` query. If you want a password-change page, that is a future feature.
