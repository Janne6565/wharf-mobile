package sshengine

import (
	"context"

	"golang.org/x/crypto/ssh"
)

// Prompt kinds surfaced through Callbacks.OnSecretPrompt.
const (
	kindPassword      = "password"       // first password ask, nothing tried yet
	kindPasswordRetry = "password_retry" // a prior password (stored or typed) was rejected
	kindKeyboard      = "ki"             // a keyboard-interactive question
)

// authMethods assembles the auth chain for mobile v1: password (with silent
// stored-password replay) then keyboard-interactive. No public-key or agent
// auth is offered — mobile carries neither. keyboard-interactive is included
// for 2FA / PAM and routes each server question through OnSecretPrompt; its
// callback only fires when the server actually offers that method.
func (e *Engine) authMethods(ctx context.Context, sessionID, user, host, storedPassword string) []ssh.AuthMethod {
	return []ssh.AuthMethod{
		e.passwordMethod(ctx, sessionID, user, host, storedPassword),
		ssh.KeyboardInteractive(func(name, instruction string, questions []string, echos []bool) ([]string, error) {
			answers := make([]string, len(questions))
			for i, q := range questions {
				secret, err := e.askSecret(ctx, sessionID, kindKeyboard, q, echos[i])
				if err != nil {
					return nil, err
				}
				answers[i] = string(secret)
			}
			return answers, nil
		}),
	}
}

// passwordMethod builds the retryable password method. A non-empty
// storedPassword is replayed on the first attempt without prompting; if the
// server rejects it later attempts prompt (4 total: 1 stored + 3 prompts,
// versus 3 prompts when nothing is stored). The first prompt with no prior
// rejection is kind "password"; every prompt following a rejected attempt
// (stored or typed) is kind "password_retry".
func (e *Engine) passwordMethod(ctx context.Context, sessionID, user, host, storedPassword string) ssh.AuthMethod {
	hasStored := storedPassword != ""
	maxAttempts := 3
	if hasStored {
		maxAttempts = 4 // 1 silent replay of the stored password + 3 prompts
	}

	attempt := 0
	cb := ssh.PasswordCallback(func() (string, error) {
		n := attempt
		attempt++
		if hasStored && n == 0 {
			return storedPassword, nil // silent replay
		}
		// RetryableAuthMethod only re-invokes this after the previous password
		// was rejected, so any attempt past the first (or past the stored one)
		// is a retry.
		kind := kindPassword
		prompt := user + "@" + host
		if n > 0 {
			kind = kindPasswordRetry
			prompt = "previous password was rejected"
		}
		secret, err := e.askSecret(ctx, sessionID, kind, prompt, false)
		if err != nil {
			return "", err
		}
		return string(secret), nil
	})
	return ssh.RetryableAuthMethod(cb, maxAttempts)
}
