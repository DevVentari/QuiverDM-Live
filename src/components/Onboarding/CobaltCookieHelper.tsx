'use client';

import { useState } from 'react';
import { Flex, Heading, Text, TextField, Button, Box, Tabs, Code } from '@radix-ui/themes';
import { Key, Check, X, ExternalLink, AlertCircle } from 'lucide-react';

interface CobaltCookieHelperProps {
  onCookieSet: (cookie: string) => void;
  initialCookie?: string;
}

export function CobaltCookieHelper({ onCookieSet, initialCookie = '' }: CobaltCookieHelperProps) {
  const [cookie, setCookie] = useState(initialCookie);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTest = async () => {
    if (!cookie.trim()) {
      setTestResult('error');
      setErrorMessage('Please enter a cookie value');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      const response = await fetch('/api/dndbeyond/test-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });

      if (response.ok) {
        setTestResult('success');
        onCookieSet(cookie);
      } else {
        const data = await response.json();
        setTestResult('error');
        setErrorMessage(data.error || 'Invalid cookie. Please check and try again.');
      }
    } catch (error) {
      setTestResult('error');
      setErrorMessage('Failed to test cookie. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Flex direction="column" gap="4">
      <Tabs.Root defaultValue="browser-extension">
        <Tabs.List>
          <Tabs.Trigger value="browser-extension">Browser Extension</Tabs.Trigger>
          <Tabs.Trigger value="dev-tools">Developer Tools</Tabs.Trigger>
          <Tabs.Trigger value="manual">Manual Entry</Tabs.Trigger>
        </Tabs.List>

        {/* Browser Extension Method */}
        <Tabs.Content value="browser-extension">
          <Flex direction="column" gap="3" p="3">
            <Text size="2" weight="bold">
              Easiest Method: Using a Browser Extension
            </Text>
            <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li>
                <Text size="2">
                  Install{' '}
                  <a
                    href="https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--violet-11)' }}
                  >
                    EditThisCookie
                  </a>{' '}
                  or{' '}
                  <a
                    href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--violet-11)' }}
                  >
                    Cookie-Editor
                  </a>
                </Text>
              </li>
              <li>
                <Text size="2">
                  Go to{' '}
                  <a
                    href="https://www.dndbeyond.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--violet-11)' }}
                  >
                    dndbeyond.com
                  </a>{' '}
                  and log in
                </Text>
              </li>
              <li>
                <Text size="2">Click the extension icon in your browser toolbar</Text>
              </li>
              <li>
                <Text size="2">
                  Find the cookie named <Code>CobaltSession</Code>
                </Text>
              </li>
              <li>
                <Text size="2">Copy the cookie value</Text>
              </li>
              <li>
                <Text size="2">Paste it in the field below</Text>
              </li>
            </ol>
          </Flex>
        </Tabs.Content>

        {/* Developer Tools Method */}
        <Tabs.Content value="dev-tools">
          <Flex direction="column" gap="3" p="3">
            <Text size="2" weight="bold">
              Using Browser Developer Tools
            </Text>
            <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li>
                <Text size="2">
                  Go to{' '}
                  <a
                    href="https://www.dndbeyond.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--violet-11)' }}
                  >
                    dndbeyond.com
                  </a>{' '}
                  and log in
                </Text>
              </li>
              <li>
                <Text size="2">
                  Press <Code>F12</Code> (or right-click → Inspect)
                </Text>
              </li>
              <li>
                <Text size="2">
                  Go to the <strong>Application</strong> tab (Chrome) or <strong>Storage</strong>{' '}
                  tab (Firefox)
                </Text>
              </li>
              <li>
                <Text size="2">
                  Expand <strong>Cookies</strong> in the left sidebar
                </Text>
              </li>
              <li>
                <Text size="2">
                  Click on <Code>https://www.dndbeyond.com</Code>
                </Text>
              </li>
              <li>
                <Text size="2">
                  Find the cookie named <Code>CobaltSession</Code>
                </Text>
              </li>
              <li>
                <Text size="2">Double-click the value to select it, then copy</Text>
              </li>
              <li>
                <Text size="2">Paste it in the field below</Text>
              </li>
            </ol>
          </Flex>
        </Tabs.Content>

        {/* Manual Entry */}
        <Tabs.Content value="manual">
          <Flex direction="column" gap="3" p="3">
            <Text size="2" color="gray">
              If you already have your CobaltSession cookie value, paste it directly in the field
              below.
            </Text>
          </Flex>
        </Tabs.Content>
      </Tabs.Root>

      {/* Cookie Input */}
      <Box>
        <label htmlFor="cobalt-cookie">
          <Text as="div" size="2" mb="1" weight="bold">
            CobaltSession Cookie
          </Text>
        </label>
        <TextField.Root
          id="cobalt-cookie"
          placeholder="Paste your CobaltSession cookie here..."
          value={cookie}
          onChange={(e) => {
            setCookie(e.target.value);
            setTestResult(null);
            setErrorMessage('');
          }}
          size="3"
        />
      </Box>

      {/* Test Result */}
      {testResult === 'success' && (
        <Box
          p="3"
          style={{
            backgroundColor: 'var(--green-3)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--green-9)',
          }}
        >
          <Flex align="center" gap="2">
            <Check size={20} style={{ color: 'var(--green-11)' }} />
            <Text size="2" style={{ color: 'var(--green-11)' }}>
              Cookie verified! You can now import characters from D&D Beyond.
            </Text>
          </Flex>
        </Box>
      )}

      {testResult === 'error' && (
        <Box
          p="3"
          style={{
            backgroundColor: 'var(--red-3)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--red-9)',
          }}
        >
          <Flex align="center" gap="2">
            <X size={20} style={{ color: 'var(--red-11)' }} />
            <Text size="2" style={{ color: 'var(--red-11)' }}>
              {errorMessage}
            </Text>
          </Flex>
        </Box>
      )}

      {/* Info Box */}
      <Box
        p="3"
        style={{
          backgroundColor: 'var(--blue-3)',
          borderRadius: '8px',
          borderLeft: '3px solid var(--blue-9)',
        }}
      >
        <Flex align="start" gap="2">
          <AlertCircle size={20} style={{ color: 'var(--blue-11)', flexShrink: 0, marginTop: '2px' }} />
          <Flex direction="column" gap="1">
            <Text size="2" weight="bold" style={{ color: 'var(--blue-11)' }}>
              Privacy & Security
            </Text>
            <Text size="2" color="gray">
              Your cookie is encrypted and stored securely. It's only used to import character data
              from D&D Beyond and is never shared with third parties.
            </Text>
          </Flex>
        </Flex>
      </Box>

      {/* Test Button */}
      <Button
        onClick={handleTest}
        disabled={testing || !cookie.trim()}
        size="3"
        style={{ backgroundColor: 'var(--violet-9)' }}
      >
        <Key size={16} />
        {testing ? 'Testing...' : 'Test & Save Cookie'}
      </Button>
    </Flex>
  );
}
