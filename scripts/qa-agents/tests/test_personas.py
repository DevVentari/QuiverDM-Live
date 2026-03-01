import os
import pytest
from personas import PERSONAS, Persona


def test_persona_count():
    assert len(PERSONAS) == 3


def test_persona_fields():
    required = {'name', 'email_env', 'message_context', 'scenario'}
    for p in PERSONAS:
        assert required.issubset(vars(p).keys()), f"Persona {p.name} missing fields"


def test_persona_email_loads_from_env(monkeypatch):
    monkeypatch.setenv('QA_NORA_EMAIL', 'nora@test.local')
    monkeypatch.setenv('QA_DANA_EMAIL', 'dana@test.local')
    monkeypatch.setenv('QA_VIC_EMAIL', 'vic@test.local')
    for p in PERSONAS:
        email = os.environ.get(p.email_env)
        assert email and '@' in email, f"{p.name} email not loadable from {p.email_env}"


def test_persona_message_context_mentions_find_problems():
    for p in PERSONAS:
        ctx = p.message_context.lower()
        assert any(word in ctx for word in ['problem', 'issue', 'friction', 'bug', 'find']), \
            f"Persona {p.name} message_context doesn't instruct agent to find problems"
