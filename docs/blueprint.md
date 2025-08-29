# **App Name**: LoginEasy

## Core Features:

- User Authentication: Securely authenticate users using bcrypt and tokens.
- Registration Form: Allow new users to register with an email and password.
- Login Form: Allow registered users to log in.
- Session Management: Maintain user sessions using cookies to identify the user and allow for future activity until the session expires.
- Forgot Password: Allow users to reset their password via email with token-based authorization.
- AI Prompt Security Check: When creating new credentials, use AI as a tool to make suggestions on password strengh, security, and best practices. Present any findings to the user, or errors and concerns raised.

## Style Guidelines:

- Primary color: Dusty rose (#C08497) to evoke calm and simplicity, rejecting the cliche of blues or greens often used for login apps.
- Background color: Light pink (#F4DFE4) with minimal saturation for a soft, clean backdrop.
- Accent color: Mauve (#A37082) with good contrast, for interactive elements.
- Font: 'Inter', a grotesque-style sans-serif with a modern look suitable for body and headlines.
- Use clean and simple vector icons from Radix UI Icons to maintain a minimalist aesthetic.
- Design a centered form layout using Radix UI primitives for accessibility and consistency.
- Implement subtle animations, like fade-ins and transitions on form elements, using Tailwind CSS for a polished user experience.