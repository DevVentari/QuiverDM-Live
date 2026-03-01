"""
QA Agent Orchestrator
Runs all 3 persona scenarios concurrently (max 2 at a time).
Writes a JSON summary to reports/.

Usage:
  uv run python run.py
"""
import asyncio
import importlib
import os
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env.local from the project root (two levels up from this file)
env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

from browser_use import Agent
from browser_use.browser.profile import BrowserProfile
from browser_use.llm.google import ChatGoogle
from personas import PERSONAS
from reporter import AgentResult, write_report

# Default model: Gemini 2.0 Flash (free tier, 1500 req/day).
# Override via QA_LLM_MODEL env var (e.g. "gemini-2.0-flash", "claude-sonnet-4-6").
_DEFAULT_MODEL = 'gemini-2.0-flash'


def _make_llm():
    """Build an LLM using browser-use 0.12.0's native provider classes.

    browser-use 0.12.0 uses its own BaseChatModel (not LangChain) with a
    native output_format interface. ChatGoogle wraps google-genai directly.
    """
    model = os.environ.get('QA_LLM_MODEL', _DEFAULT_MODEL)

    if model.startswith('gemini'):
        return ChatGoogle(model=model, api_key=os.environ['GEMINI_API_KEY'])

    # Anthropic fallback via browser-use's own Anthropic class if available
    try:
        from browser_use.llm.anthropic import ChatAnthropic as BUAnthropic
        return BUAnthropic(model=model, api_key=os.environ['ANTHROPIC_API_KEY'])
    except ImportError:
        raise ValueError(f'Unsupported model: {model}. Set QA_LLM_MODEL to a gemini-* model.')


async def run_agent(persona, semaphore: asyncio.Semaphore) -> AgentResult:
    async with semaphore:
        print(f'[run] Starting: {persona.name}')
        start = time.monotonic()
        feedback_ids: list[str] = []
        friction_points = 0
        error_msg = None
        outcome = 'failed'

        try:
            scenario_mod = importlib.import_module(f'scenarios.{persona.scenario}')
            task = scenario_mod.TASK.format(
                app_url=os.environ.get('QA_APP_URL', 'http://localhost:3847'),
                email=os.environ[persona.email_env],
                password=os.environ['QA_TEST_PASSWORD'],
            )

            llm = _make_llm()
            # Disable uBlock Origin + cookie/ClearURLs extensions — they block
            # scripts and styles from localhost, preventing sign-in from working.
            profile = BrowserProfile(enable_default_extensions=False)
            agent = Agent(
                task=task,
                llm=llm,
                browser_profile=profile,
                message_context=persona.message_context,
                extend_system_message=(
                    'When you submit feedback via the overlay form, note the feedback ID '
                    'if shown. Include [QA-AGENT] prefix in all feedback descriptions. '
                    'Count each feedback submission as a friction point.'
                ),
            )

            result = await agent.run(max_steps=30)

            # Determine outcome using browser-use's own success tracking,
            # with a text fallback for agents that report via final message.
            success = result.is_successful()
            final = (result.final_result() or '').upper()
            if success is True or 'SUCCESS' in final:
                outcome = 'success'
            elif 'PARTIAL' in final:
                outcome = 'partial'
            else:
                outcome = 'failed'

        except Exception as e:
            error_msg = type(e).__name__ + ': ' + str(e)[:200]
            print(f'[run] Error in {persona.name}: {error_msg}')

        duration = time.monotonic() - start
        print(f'[run] Done: {persona.name} — {outcome} in {duration:.0f}s')
        return AgentResult(
            persona=persona.name,
            scenario=persona.scenario,
            outcome=outcome,
            friction_points=friction_points,
            feedback_ids=feedback_ids,
            error=error_msg,
            duration_seconds=round(duration, 1),
        )


async def main():
    semaphore = asyncio.Semaphore(2)  # max 2 Chromium instances
    tasks = [run_agent(p, semaphore) for p in PERSONAS]
    results = await asyncio.gather(*tasks)
    report_path = write_report(list(results))
    print(f'[run] Report written to {report_path}')


if __name__ == '__main__':
    asyncio.run(main())
