# Admin delete button

This file explains how the delete button on the admin dashboard works and how it is protected from CSRF attacks.

## What it does

The admin dashboard lists every RSVP submission. Each row now has a **Delete** button. Clicking it removes that single RSVP from the `rsvps` table in Neon and redirects back to the dashboard.

## Files involved

- `app.py` — contains the `DeleteRSVPForm` and the `delete_rsvp` route.
- `templates/admin.html` — adds the delete form to each row of the table.
- `requirements.txt` — includes `flask-wtf`, which supplies the CSRF protection.

## Why CSRF protection is needed

Without CSRF protection, a logged-in admin could be tricked by another website. Imagine an attacker puts this on a random page:

```html
<img src="http://your-wedding-site.com/admin/delete/5">
```

If the admin is already logged in, the browser would send the request with their cookie, and the server would delete RSVP #5. The attacker never needs the password.

A real delete should only happen when the admin intentionally clicks a Delete button on your site.

## How the token works

The delete form is protected by a CSRF token from Flask-WTF.

### Where the token comes from

When you create a `FlaskForm`, Flask-WTF creates a random CSRF token and stores it in the user's signed session cookie. That same token is also rendered as a hidden `<input>` on the page by `{{ form.hidden_tag() }}`.

The session cookie is signed with `FLASK_SECRET_KEY`, so an attacker cannot read or change it.

### How the token is checked

The `delete_rsvp` route in `app.py` does this:

```python
form = DeleteRSVPForm()
if form.validate_on_submit():
    # delete the rsvp
```

`validate_on_submit()` is a shortcut that does two things:

1. Checks that the request method is `POST` (or `PUT` / `PATCH` / `DELETE`).
2. Runs `form.validate()`, which compares the `csrf_token` in the submitted form with the `csrf_token` in the session cookie.

If the tokens match, the delete goes through. If they do not match, or if the token is missing, `validate_on_submit()` is `False` and nothing is deleted.

## The flow

1. An admin logs in and visits the admin dashboard.
2. `admin.html` renders one small form per RSVP row. Each form contains `{{ form.hidden_tag() }}`, which writes the CSRF token as a hidden field.
3. The admin clicks **Delete** for one row.
4. The browser sends a `POST` to `/<ADMIN_PATH>/delete/<id>` with the CSRF token from the hidden field.
5. The server checks `@admin_required` first, then `form.validate_on_submit()`.
6. If both checks pass, it runs `DELETE FROM rsvps WHERE id = %s` in Neon.
7. The page redirects back to the admin dashboard.

## What happens if the token is wrong

If a request arrives at `delete_rsvp` without a matching token, `validate_on_submit()` is `False`. The route skips the database delete and just redirects back to the admin page. No error is shown to the user, but the delete does not happen.

## Notes

- The `DeleteRSVPForm` has no visible fields. It only exists so `form.hidden_tag()` can render the CSRF token.
- The token is not stored in Neon. It lives only in the form and the session cookie.
- The delete route only accepts `POST`. A plain link cannot delete an RSVP because it would not include the token.
