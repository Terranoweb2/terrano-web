#!/usr/bin/env python3
"""
Postfix pipe script: receives an email from stdin, parses it,
and POSTs it to the TerranoWeb webhook API.
"""
import sys
import email
import email.policy
import json
import urllib.request
import urllib.error
import re

WEBHOOK_URL = "https://terranoweb.win/api/mail/incoming"
WEBHOOK_SECRET = "tw_incoming_8f3a9c2d7e1b5046"

def get_text_body(msg):
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in disp:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    try:
                        return payload.decode(charset, errors="replace")
                    except Exception:
                        return payload.decode("utf-8", errors="replace")
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ct == "text/html" and "attachment" not in disp:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    try:
                        text = payload.decode(charset, errors="replace")
                    except Exception:
                        text = payload.decode("utf-8", errors="replace")
                    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
                    text = re.sub(r"<p[^>]*>", "\n", text, flags=re.I)
                    text = re.sub(r"<[^>]+>", "", text)
                    text = re.sub(r"&nbsp;", " ", text)
                    text = re.sub(r"&amp;", "&", text)
                    text = re.sub(r"&lt;", "<", text)
                    text = re.sub(r"&gt;", ">", text)
                    return text.strip()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            try:
                return payload.decode(charset, errors="replace")
            except Exception:
                return payload.decode("utf-8", errors="replace")
    return "(contenu non disponible)"

def extract_email_addr(header_value):
    if not header_value:
        return ""
    addr = str(header_value).strip()
    if "<" in addr and ">" in addr:
        return addr.split("<")[1].split(">")[0].strip().lower()
    return addr.strip().lower()

def extract_name(header_value):
    if not header_value:
        return ""
    addr = str(header_value).strip()
    if "<" in addr:
        name = addr.split("<")[0].strip()
        name = name.strip('"').strip("'")
        if name:
            return name
    return ""

def main():
    try:
        raw = sys.stdin.buffer.read()
        msg = email.message_from_bytes(raw, policy=email.policy.default)

        from_header = msg.get("From", "")
        to_header = msg.get("To", "")
        subject = str(msg.get("Subject", "")) or "(sans objet)"
        body = get_text_body(msg)

        from_email = extract_email_addr(from_header)
        from_name = extract_name(from_header) or from_email
        to_email = extract_email_addr(to_header)

        if not from_email or not to_email:
            print("Missing from ({}) or to ({})".format(from_email, to_email), file=sys.stderr)
            sys.exit(0)

        if "noreply@terranomail.org" in from_email:
            print("Skipping noreply loop", file=sys.stderr)
            sys.exit(0)

        payload = json.dumps({
            "secret": WEBHOOK_SECRET,
            "from": from_email,
            "fromName": from_name,
            "to": to_email,
            "subject": subject,
            "body": body
        }).encode("utf-8")

        req = urllib.request.Request(
            WEBHOOK_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "TerranoWeb-MailPipe/1.0",
                "Accept": "application/json"
            },
            method="POST"
        )

        try:
            resp = urllib.request.urlopen(req, timeout=15)
            result = resp.read().decode("utf-8")
            print("OK: {}".format(result), file=sys.stderr)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print("HTTP {}: {}".format(e.code, err_body), file=sys.stderr)
        except urllib.error.URLError as e:
            print("URL Error: {}".format(e.reason), file=sys.stderr)

    except Exception as e:
        print("Script error: {}".format(e), file=sys.stderr)

    sys.exit(0)

if __name__ == "__main__":
    main()
