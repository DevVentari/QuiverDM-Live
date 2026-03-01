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
from langchain_anthropic import ChatAnthropic
from personas import PERSONAS
from reporter import AgentResult, write_report


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

            llm = ChatAnthropic(model='claude-sonnet-4-6')
            agent = Agent(
                task=task,
                llm=llm,
                message_context=persona.message_context,
                extend_system_message=(
                    'When you submit feedback via the overlay form, note the feedback ID '
                    'if shown. Include [QA-AGENT] prefix in all feedback descriptions. '
                    'Count each feedback submission as a friction point.'
                ),
            )

            result = await agent.run(max_steps=30)

            # Parse outcome from agent's final message
            final = str(result).upper()
            if 'SUCCESS' in final:
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
