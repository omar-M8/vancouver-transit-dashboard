import { useState } from 'react';
import {
  Card,
  Text,
  Group,
  Button,
  Badge,
  Code,
  Stack,
  TextInput,
  Paper,
  Box,
  Loader,
} from '@mantine/core';
import { IconServer, IconPlayerPlay, IconCheck } from '@tabler/icons-react';
import { useTransitStore } from '../stores/useTransitStore';

interface EndpointConfig {
  name: string;
  method: 'GET';
  pathTemplate: string;
  description: string;
  defaultParam?: string;
  paramName?: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    name: 'Backend Health & Greeting',
    method: 'GET',
    pathTemplate: '/',
    description: 'FastAPI root sanity check returning greeting message.',
  },
  {
    name: 'Active Stops & Telemetry',
    method: 'GET',
    pathTemplate: '/debug/active-stops',
    description:
      'Aggregates full GTFS-RT feed: punctuality %, average delay, and broadcasting stop counts.',
  },
  {
    name: 'Station Realtime Arrivals',
    method: 'GET',
    pathTemplate: '/transit/{station_id}',
    description:
      'Queries GTFS realtime trip updates filtered for a specific station or stop ID.',
    paramName: 'station_id',
    defaultParam: '50915',
  },
  {
    name: 'Consolidated Dashboard Payload',
    method: 'GET',
    pathTemplate: '/metrics/dashboard/{station_id}',
    description:
      'Single-pass endpoint combining system metrics, station departures, and route leaderboard.',
    paramName: 'station_id',
    defaultParam: '50915',
  },
];

export function BackendExplorer() {
  const { backendUrl, isConnected } = useTransitStore();
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig>(ENDPOINTS[1]);
  const [paramValue, setParamValue] = useState('50915');
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activePath = selectedEndpoint.paramName
    ? selectedEndpoint.pathTemplate.replace(`{${selectedEndpoint.paramName}}`, paramValue.trim() || '50915')
    : selectedEndpoint.pathTemplate;

  const fullUrl = `${backendUrl}${activePath}`;

  const handleExecute = async () => {
    setLoading(true);
    setResponseData(null);
    setResponseStatus(null);
    const start = performance.now();

    try {
      const res = await fetch(fullUrl);
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResponseStatus(res.status);

      const json = await res.json();
      setResponseData(JSON.stringify(json, null, 2));
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResponseStatus(0);
      setResponseData(
        JSON.stringify(
          {
            error: 'Failed to fetch from backend',
            details: err instanceof Error ? err.message : String(err),
            suggestion: `Ensure FastAPI is running: backend/venv/bin/uvicorn backend.main:app --port 8000 --reload`,
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (responseData) {
      navigator.clipboard.writeText(responseData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card
      p="lg"
      radius="md"
      style={{
        backgroundColor: '#131e2b',
        border: '1px solid #1e2e3d',
      }}
    >
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Group gap="xs">
            <IconServer size={20} color="#38bdf8" />
            <Text fw={700} size="md" c="#f1f5f9">
              FastAPI Backend Inspector
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Test and inspect the live JSON endpoints exposed by <code>backend/main.py</code>
          </Text>
        </div>
        <Badge variant="filled" color={isConnected ? 'teal' : 'gray'}>
          Target: {backendUrl}
        </Badge>
      </Group>

      {/* Endpoint selection tabs / buttons */}
      <Stack gap="sm">
        <Group gap="xs" wrap="wrap">
          {ENDPOINTS.map((ep) => {
            const isSel = ep.pathTemplate === selectedEndpoint.pathTemplate;
            return (
              <Button
                key={ep.pathTemplate}
                size="xs"
                variant={isSel ? 'filled' : 'subtle'}
                color={isSel ? 'cyan' : 'gray'}
                onClick={() => {
                  setSelectedEndpoint(ep);
                  setResponseData(null);
                  setResponseStatus(null);
                }}
                styles={{
                  root: {
                    border: isSel ? 'none' : '1px solid #1e2e3d',
                    backgroundColor: isSel ? undefined : '#0f172a',
                    color: isSel ? undefined : '#94a3b8',
                  },
                }}
              >
                <Badge size="xs" variant="filled" color="blue" mr={6}>
                  {ep.method}
                </Badge>
                {ep.pathTemplate}
              </Button>
            );
          })}
        </Group>

        <Text size="xs" c="dimmed">
          {selectedEndpoint.description}
        </Text>

        {/* Query Input + Execute Button */}
        <Paper p="sm" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e2e3d' }}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="xs" style={{ flexGrow: 1 }}>
              <Badge variant="filled" color="blue">
                {selectedEndpoint.method}
              </Badge>
              <Text size="xs" ff="monospace" c="#38bdf8">
                {fullUrl}
              </Text>
              {selectedEndpoint.paramName && (
                <TextInput
                  size="xs"
                  placeholder="station_id (e.g. 50915)"
                  value={paramValue}
                  onChange={(e) => setParamValue(e.currentTarget.value)}
                  style={{ width: 140 }}
                  styles={{
                    input: {
                      backgroundColor: '#16222f',
                      borderColor: '#243547',
                      color: '#f1f5f9',
                    },
                  }}
                />
              )}
            </Group>
            <Button
              size="xs"
              color="cyan"
              leftSection={<IconPlayerPlay size={14} />}
              loading={loading}
              onClick={handleExecute}
            >
              Send Request
            </Button>
          </Group>
        </Paper>

        {/* Response Box */}
        {(responseData || loading) && (
          <Paper
            p="md"
            radius="md"
            style={{
              backgroundColor: '#090d12',
              border: '1px solid #1e2e3d',
            }}
          >
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <Text size="xs" fw={700} c="dimmed">
                  RESPONSE
                </Text>
                {responseStatus !== null && (
                  <Badge
                    size="xs"
                    color={responseStatus >= 200 && responseStatus < 300 ? 'teal' : 'red'}
                  >
                    HTTP {responseStatus === 0 ? 'Network Error' : responseStatus}
                  </Badge>
                )}
                {latencyMs !== null && (
                  <Badge size="xs" variant="outline" color="gray">
                    {latencyMs} ms
                  </Badge>
                )}
              </Group>

              {responseData && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="cyan"
                  onClick={handleCopy}
                  leftSection={copied ? <IconCheck size={12} /> : undefined}
                >
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
              )}
            </Group>

            {loading ? (
              <Box p="lg" style={{ textAlign: 'center' }}>
                <Loader size="sm" color="cyan" />
                <Text size="xs" c="dimmed" mt="xs">
                  Querying FastAPI backend at {fullUrl}...
                </Text>
              </Box>
            ) : (
              <Code
                block
                style={{
                  backgroundColor: 'transparent',
                  color: '#38bdf8',
                  maxHeight: 320,
                  overflowY: 'auto',
                  fontSize: 12,
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {responseData}
              </Code>
            )}
          </Paper>
        )}
      </Stack>
    </Card>
  );
}
