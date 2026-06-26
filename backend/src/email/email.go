package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type recipient struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type sendRequest struct {
	To      recipient `json:"to"`
	From    recipient `json:"from"`
	Subject string    `json:"subject"`
	HTML    string    `json:"html"`
	Text    string    `json:"text"`
}

func send(to recipient, subject, html, text string) error {
	payload := sendRequest{
		To: to,
		From: recipient{
			Email: os.Getenv("AUTOSEND_FROM_EMAIL"),
			Name:  os.Getenv("AUTOSEND_FROM_NAME"),
		},
		Subject: subject,
		HTML:    html,
		Text:    text,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.autosend.com/v1/mails/send", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("AUTOSEND_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("autosend: HTTP %d", resp.StatusCode)
	}
	return nil
}

func SendVerificationCode(toEmail, toName, code string) error {
	subject := "Your Bloom verification code"
	html := verificationHTML(toName, code)
	text := fmt.Sprintf("Your Bloom verification code is: %s\n\nIt expires in 15 minutes.", code)
	return send(recipient{Email: toEmail, Name: toName}, subject, html, text)
}

func verificationHTML(name, code string) string {
	displayName := name
	if displayName == "" {
		displayName = "there"
	}

	// Split code into individual digit spans for the styled boxes
	digits := ""
	for _, ch := range code {
		digits += fmt.Sprintf(`<span style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;background-color:#1d1a17;border:1px solid #3c352f;border-radius:8px;font-size:26px;font-weight:600;color:#e8cfa9;margin:0 4px;letter-spacing:0;">%c</span>`, ch)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Bloom Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#141210;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141210;min-height:100vh;">
    <tr>
      <td align="center" style="padding:60px 16px;">

        <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="font-size:22px;font-weight:600;color:#f7efe2;letter-spacing:-0.5px;">Bloom</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1d1a17;border:1px solid #24201c;border-radius:14px;padding:40px 36px;">

              <p style="margin:0 0 8px 0;font-size:13px;font-weight:500;color:#9e8e7d;text-transform:uppercase;letter-spacing:0.08em;">Email verification</p>
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#f7efe2;line-height:1.3;">Hi %s, here's your code</h1>
              <p style="margin:0 0 32px 0;font-size:14px;color:#9e8e7d;line-height:1.6;">
                Enter the 6-digit code below to verify your email address and activate your Bloom account. It expires in <strong style="color:#f7efe2;">15 minutes</strong>.
              </p>

              <!-- Code boxes -->
              <div style="text-align:center;margin-bottom:36px;">
                %s
              </div>

              <hr style="border:none;border-top:1px solid #24201c;margin:0 0 28px 0;" />

              <p style="margin:0;font-size:12px;color:#6b5f54;line-height:1.6;">
                If you didn't create a Bloom account, you can safely ignore this email.<br/>
                This code was sent from <span style="color:#9e8e7d;">%s</span>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:12px;color:#6b5f54;">
                &copy; 2026 Bloom &mdash; Simply works.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, displayName, digits, os.Getenv("AUTOSEND_FROM_EMAIL"))
}
