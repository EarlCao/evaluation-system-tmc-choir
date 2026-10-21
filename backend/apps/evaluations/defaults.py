"""Default rating criteria from the specification (§3.3), used by `seed_demo_data`."""

FIVE_POINT_LABELS = {
    "1": "Needs improvement",
    "2": "Developing",
    "3": "Satisfactory",
    "4": "Good",
    "5": "Excellent",
}

DEFAULT_CATEGORIES = ["Commitment", "Musicianship", "Teamwork"]

# (key, category, name, description)
DEFAULT_CRITERIA = [
    ("attendance", "Commitment", "Attendance", "Comes to rehearsals and performances on time."),
    ("preparation", "Commitment", "Preparation", "Knows the music and has practised the parts."),
    ("teamwork", "Teamwork", "Teamwork", "Supports and listens to fellow singers."),
    ("discipline", "Commitment", "Discipline", "Focus and conduct during rehearsals."),
    (
        "vocal-performance",
        "Musicianship",
        "Vocal performance",
        "Tone, pitch, blend and expression.",
    ),
    ("participation", "Teamwork", "Participation", "Takes part actively in choir activities."),
]

DEFAULT_COMMENT_PROMPTS = [
    {
        "key": "comment",
        "label": "Comments (Unsay imong ikaingon sa akoa?)",
        "is_required": False,
    },
    {
        "key": "suggestion",
        "label": "Suggestions (Unsay imong ikasuggest sa akoa?)",
        "is_required": False,
    },
    {
        "key": "comment_3",
        "label": "Strengths / Positive traits (Unsay maayo nga nakita nimo sa akoa?)",
        "is_required": False,
    },
    {
        "key": "comment_4",
        "label": "Areas for growth (Unsay angay pa nakong palambuon?)",
        "is_required": False,
    },
    {
        "key": "comment_5",
        "label": "Encouragement / Message (Unsay imong mensahe o pagdasig para sa akoa?)",
        "is_required": False,
    },
]
