export async function sendRsvpNotification(env, submission, guests) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.NOTIFY_EMAILS) {
    return;
  }

  const toList = env.NOTIFY_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
  if (toList.length === 0) {
    return;
  }

  const guestsList = guests
    .filter((g) => g.first || g.last)
    .map((g) => `${g.first} ${g.last}`)
    .join("\n");

  const textBody = `New RSVP from ${submission.first_name} ${submission.last_name}

Email: ${submission.email}
Phone: ${submission.phone}
Attendance: ${submission.attendance}
Party Size: ${submission.party_size}

Additional Guests:
${guestsList || "None"}

Song Request:
${submission.song_request || "None"}`;

  const htmlBody = `<p>New RSVP from <strong>${escapeHtml(
    submission.first_name
  )} ${escapeHtml(submission.last_name)}</strong></p>
<p>Email: ${escapeHtml(submission.email)}<br>
Phone: ${escapeHtml(submission.phone)}<br>
Attendance: ${escapeHtml(submission.attendance)}<br>
Party Size: ${submission.party_size}</p>
<p><strong>Additional Guests:</strong><br>
${escapeHtml(guestsList || "None")}</p>
<p><strong>Song Request:</strong><br>
${escapeHtml(submission.song_request || "None")}</p>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: toList,
        subject: `New RSVP: ${submission.first_name} ${submission.last_name}`,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend error ${response.status}: ${body}`);
    }
  } catch (e) {
    console.error("Failed to send email notification:", e);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
