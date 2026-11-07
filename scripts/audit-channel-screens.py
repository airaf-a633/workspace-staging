"""Measures how plain the channel screens are against docs/SIMPLICITY_AUDIT.md. Run it again after changing channel wording."""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web", "src")  # run: python scripts/audit-channel-screens.py [out.json]
os.chdir(ROOT)

# (namespace, new-page folder, forms file, component name in [id]/page.tsx)
CHANNELS = [
    ("apiSetup", "api", "components/channels/api-inbox.tsx", "ApiChannel"),
    ("telegramSetup", "telegram", "components/channels/telegram-forms.tsx", "TelegramChannel"),
    ("lineSetup", "line", "components/channels/line-forms.tsx", "LineChannel"),
    ("smsSetup", "sms", "components/channels/sms-forms.tsx", "SmsChannel"),
    ("voiceSetup", "voice", "components/channels/voice-forms.tsx", "VoiceChannel"),
    ("slackSetup", "slack", None, "SlackChannel"),
    ("discordSetup", "discord", "components/channels/discord-forms.tsx", "DiscordChannel"),
    ("teamsSetup", "teams", "components/channels/teams-forms.tsx", "TeamsChannel"),
    ("viberSetup", "viber", "components/channels/viber-forms.tsx", "ViberChannel"),
    ("xSetup", "x", "components/channels/x-forms.tsx", "XChannel"),
]

JARGON = [
    "webhook", "endpoint", "token", "oauth", "api", "tenant", "intent", "intents", "secret", "azure", "entra", "sid",
    "e.164", "http", "post", "callback", "gateway", "credentials", "ssl", "https", "manifest", "payload", "scope",
    "bearer", "developer portal", "developer console", "client id", "mention", "bot", "messaging endpoint", "twiml",
    "stop", "vault", "json", "key", "keys", "domain", "dns",
]
# Words the platform's own screen uses, so the person has to match them exactly: they stay, with help text.
PLATFORM_TERMS = ["account sid", "auth token", "client id", "client secret", "bearer token", "bot token", "directory (tenant) id", "application (client) id", "developer portal", "developer console"]


def namespace_block(src: str, name: str) -> str:
    m = re.search(rf"^  {name}: \{{\n", src, re.M)
    if not m:
        return ""
    depth, i = 1, m.end()
    while depth and i < len(src):
        c = src[i]
        depth += (c == "{") - (c == "}")
        i += 1
    return src[m.end():i - 1]


def strings(block: str) -> dict[str, str]:
    """Flat keys, with nested errors as errors.x."""
    out, prefix_stack = {}, []
    for line in block.split("\n"):
        m = re.match(r"^\s*(\w+): \{\s*$", line)
        if m:
            prefix_stack.append(m.group(1))
            continue
        if re.match(r"^\s*\},?\s*$", line) and prefix_stack:
            prefix_stack.pop()
            continue
        m = re.match(r'^\s*(\w+): "((?:[^"\\]|\\.)*)",?\s*$', line)
        if m:
            out[".".join(prefix_stack + [m.group(1)])] = m.group(2).replace('\\"', '"').replace("\\'", "'")
    return out


def component_source(page_src: str, name: str) -> str:
    m = re.search(rf"function {name}\b", page_src)
    if not m:
        return ""
    nxt = re.search(r"\n/\*|\nexport default|\nasync function \w+\(", page_src[m.end():])
    return page_src[m.start(): m.end() + (nxt.start() if nxt else len(page_src))]


def used_keys(src: str) -> set[str]:
    return set(re.findall(r'\bt\("([\w.]+)"', src))


def words(s: str) -> int:
    return len(re.findall(r"[A-Za-z0-9’'()./-]+", re.sub(r"\{[^}]+\}", "x", s)))


def sentences(s: str) -> list[str]:
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+", s) if x.strip()]


def jargon_in(s: str) -> list[str]:
    low = s.lower()
    hits = []
    for j in JARGON:
        if re.search(rf"(?<![\w-]){re.escape(j)}(?![\w-])", low):
            if any(j in p and p in low for p in PLATFORM_TERMS):
                continue
            hits.append(j)
    return hits


def main():
    en = open("i18n/messages/en.ts", encoding="utf8").read()
    page = open("app/w/[slug]/channels/[id]/page.tsx", encoding="utf8").read()
    report = {}
    for ns, folder, forms, comp in CHANNELS:
        strs = strings(namespace_block(en, ns))
        connect_src = open(f"app/w/[slug]/channels/new/{folder}/page.tsx", encoding="utf8").read() if os.path.exists(f"app/w/[slug]/channels/new/{folder}/page.tsx") else ""
        if forms and os.path.exists(forms):
            connect_src += open(forms, encoding="utf8").read()
        detail_src = component_source(page, comp)
        # What is visible on first view: anything folded behind "More settings" or "Good to know" is not.
        detail_src = re.sub(r"<MoreSettings.*?</MoreSettings>|<GoodToKnow>.*?</GoodToKnow>", "", detail_src, flags=re.S)
        for label, src in (("connect", connect_src), ("page", detail_src)):
            keys = sorted(k for k in used_keys(src) if k in strs)
            texts = {k: strs[k] for k in keys}
            all_sent = [(k, s) for k, v in texts.items() for s in sentences(v)]
            report[f"{ns}:{label}"] = {
                "strings": len(texts),
                "words": sum(words(v) for v in texts.values()),
                "long_sentences": [(k, words(s), s) for k, s in all_sent if words(s) > 20],
                "over15": sum(1 for _, s in all_sent if words(s) > 15),
                "sentences": len(all_sent),
                "jargon": sorted({j for v in texts.values() for j in jargon_in(v)}),
                "sections": len(re.findall(r"<section|<Notice", src)),
                "forms": len(re.findall(r"<form|Form\b|ReplaceCredentials|ReplaceToken|ReplaceSecrets|ReplaceSecret", src)),
            }
    json.dump(report, open(sys.argv[1] if len(sys.argv) > 1 else "audit.json", "w"), indent=1)
    print(f"{'screen':28} {'words':>5} {'str':>4} {'>15w':>5} {'>20w':>5} {'blocks':>6}  jargon")
    for k, r in report.items():
        print(f"{k:28} {r['words']:5} {r['strings']:4} {r['over15']:5} {len(r['long_sentences']):5} {r['sections']:6}  {', '.join(r['jargon'])}")
    tot = sum(r["words"] for r in report.values())
    print("total words", tot, " >20-word sentences:", sum(len(r["long_sentences"]) for r in report.values()))


main()
