#!/usr/bin/env python3
"""
Create Outlook draft emails from emails.csv, one email per unique address.
Papers are grouped so a person with multiple papers gets one combined email.

Drafts land in Outlook's Drafts folder — review and send from there.

Usage:
    python send_drafts.py --base-url https://wordnorms.com
    python send_drafts.py --base-url https://wordnorms.com --dry-run
"""
import argparse
import csv
import os
import subprocess
import tempfile
from collections import defaultdict

EMAILS_CSV = os.path.join(os.path.dirname(__file__), "pdfs", "emails.csv")

SUBJECT = "Your language resource paper is part of a community database"

BODY_SINGLE = """\
Hi there,

We're reaching out because your work is part of something we think you'll find interesting.

Building on the Linguistic Annotated Bibliography (LAB; Buchanan, Valentine, & Maxwell, 2019), we've developed an online interface that automatically identifies language resource papers and extracts key metadata from them — things like stimuli type, language, dataset size, and keywords.

Your paper has been picked up by our system, and we'd love your help: we're asking authors to log in and check whether the information extracted for their paper is accurate. This serves two purposes:

1. It helps us build a high-quality training dataset to improve the automatic extraction pipeline
2. It ensures the resource itself is accurate and useful for researchers who rely on it to find stimuli and norms

It should only take a few minutes, and you'd be directly contributing to a community resource used by psycholinguists worldwide.

{links}

While you're there, feel free to explore — you can search across hundreds of language resource papers by language, stimuli type, and keyword tags, all in one place.

Thank you so much for your time, and for the work that made it worth including!

Best,
Erin Buchanan
"""

BODY_MULTI = """\
Hi there,

We're reaching out because your work is part of something we think you'll find interesting.

Building on the Linguistic Annotated Bibliography (LAB; Buchanan, Valentine, & Maxwell, 2019), we've developed an online interface that automatically identifies language resource papers and extracts key metadata from them — things like stimuli type, language, dataset size, and keywords.

The following papers of yours have been picked up by our system, and we'd love your help: we're asking authors to log in and check whether the information extracted for each paper is accurate. This serves two purposes:

1. It helps us build a high-quality training dataset to improve the automatic extraction pipeline
2. It ensures the resource itself is accurate and useful for researchers who rely on it to find stimuli and norms

It should only take a few minutes per paper, and you'd be directly contributing to a community resource used by psycholinguists worldwide.

{links}

While you're there, feel free to explore — you can search across hundreds of language resource papers by language, stimuli type, and keyword tags, all in one place.

Thank you so much for your time, and for the work that made it worth including!

Best,
Erin Buchanan
"""


def create_outlook_draft(to_addr, subject, body, dry_run=False):
    if dry_run:
        print(f"\n  To: {to_addr}")
        print(f"  Subject: {subject}")
        preview = body.split("\n")[0:4]
        print("  " + "\n  ".join(preview) + "\n  ...")
        return True

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(body)
        tmp_path = f.name

    subject_esc = subject.replace("\\", "\\\\").replace('"', '\\"')
    to_esc = to_addr.replace("\\", "\\\\").replace('"', '\\"')

    script = f'''
set bodyFile to POSIX file "{tmp_path}"
set bodyText to read bodyFile as «class utf8»
tell application "Microsoft Outlook"
    set newMessage to make new outgoing message with properties {{subject:"{subject_esc}", plain text content:bodyText}}
    make new recipient at newMessage with properties {{email address:{{address:"{to_esc}"}}}}
    save newMessage
end tell
do shell script "rm " & quoted form of "{tmp_path}"
'''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  AppleScript error: {result.stderr.strip()}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://manynorms.wordnorms.com",
                        help="Base URL of the site (default: https://manynorms.wordnorms.com)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be sent without creating drafts")
    args = parser.parse_args()

    # Group papers by email address
    by_email = defaultdict(dict)  # email -> {paper_id: (paper_id, title)}

    with open(EMAILS_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            paper_id = row["paper_id"]
            title = row["title"]
            for addr in row.get("emails", "").split(";"):
                addr = addr.strip().lower()
                if addr and "@" in addr:
                    by_email[addr][paper_id] = (paper_id, title)

    total_papers = sum(len(v) for v in by_email.values())
    print(f"Found {len(by_email)} unique email addresses covering {total_papers} paper links")
    if args.dry_run:
        print("DRY RUN — no drafts will be created\n")

    created = errors = 0

    for addr, papers_map in sorted(by_email.items()):
        papers = list(papers_map.values())

        if len(papers) == 1:
            pid, title = papers[0]
            link = f"{args.base_url}/norms/{pid}/suggest-edit"
            links_block = f"👉 Check and validate your paper here:\n{link}"
            body = BODY_SINGLE.format(links=links_block)
        else:
            lines = []
            for pid, title in papers:
                link = f"{args.base_url}/norms/{pid}/suggest-edit"
                lines.append(f"  • {title}\n    {link}")
            links_block = "👉 Check and validate your papers here:\n\n" + "\n\n".join(lines)
            body = BODY_MULTI.format(links=links_block)

        label = f"({len(papers)} paper{'s' if len(papers) > 1 else ''})"
        print(f"  {addr} {label}", end=" ... ", flush=True)

        ok = create_outlook_draft(addr, SUBJECT, body, dry_run=args.dry_run)
        if ok:
            print("ok")
            created += 1
        else:
            errors += 1

    print(f"\nDone — {created} drafts created, {errors} errors")
    if not args.dry_run and created:
        print("Open Outlook → Drafts to review and send.")


if __name__ == "__main__":
    main()
