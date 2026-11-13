import { SimpleGrid, Card, Text, Group, RingProgress, Badge, Skeleton } from '@mantine/core';
import {
  IconActivity,
  IconClock,
  IconBus,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useTransitStore } from '../stores/useTransitStore';

export function MetricCards() {
  const { systemMetrics, isLoading } = useTransitStore();

  if (isLoading && !systemMetrics) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={120} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  const metrics = systemMetrics || {
    activeStops: 0,
    totalStops: 1480,
    punctualityPercent: 0,
    avgDelayMinutes: 0,
    delayedTripsCount: 0,
    totalActiveTrips: 0,
  };

  const stopBroadcastRatio = metrics.totalStops > 0
    ? Math.round((metrics.activeStops / metrics.totalStops) * 100)
    : 0;

  const punctualityColor =
    metrics.punctualityPercent >= 90
      ? 'teal'
      : metrics.punctualityPercent >= 75
      ? 'yellow'
      : 'red';

  const delayColor =
    metrics.avgDelayMinutes <= 2
      ? 'teal'
      : metrics.avgDelayMinutes <= 5
      ? 'yellow'
      : 'red';

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {/* 1. Active Broadcasting Stops */}
      <Card
        p="md"
        radius="md"
        style={{
          backgroundColor: '#131e2b',
          border: '1px solid #1e2e3d',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Broadcasting Stops
            </Text>
            <Text fw={700} size="xl" mt={4} c="#f1f5f9">
              {metrics.activeStops.toLocaleString()}{' '}
              <Text span size="sm" c="dimmed" fw={400}>
                / {metrics.totalStops.toLocaleString()}
              </Text>
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" variant="light" color="cyan">
                {stopBroadcastRatio}% network coverage
              </Badge>
            </Group>
          </div>
          <RingProgress
            size={52}
            roundCaps
            thickness={5}
            sections={[{ value: stopBroadcastRatio, color: 'cyan' }]}
          />
        </Group>
      </Card>

      {/* 2. Network Punctuality */}
      <Card
        p="md"
        radius="md"
        style={{
          backgroundColor: '#131e2b',
          border: '1px solid #1e2e3d',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Network Punctuality
            </Text>
            <Text fw={700} size="xl" mt={4} c="#f1f5f9">
              {metrics.punctualityPercent.toFixed(1)}%
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" variant="light" color={punctualityColor}>
                {metrics.punctualityPercent >= 90 ? 'Excellent' : metrics.punctualityPercent >= 75 ? 'Moderate' : 'Severe Delay'}
              </Badge>
            </Group>
          </div>
          <RingProgress
            size={52}
            roundCaps
            thickness={5}
            sections={[{ value: Math.min(100, metrics.punctualityPercent), color: punctualityColor }]}
          />
        </Group>
      </Card>

      {/* 3. Average System Delay */}
      <Card
        p="md"
        radius="md"
        style={{
          backgroundColor: '#131e2b',
          border: '1px solid #1e2e3d',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Avg System Delay
            </Text>
            <Text fw={700} size="xl" mt={4} c="#f1f5f9">
              +{metrics.avgDelayMinutes.toFixed(1)}{' '}
              <Text span size="sm" c="dimmed" fw={400}>
                min
              </Text>
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" variant="light" color={delayColor} leftSection={<IconClock size={10} />}>
                Active Trips Delay
              </Badge>
            </Group>
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              backgroundColor: '#1a2838',
              color: '#38bdf8',
            }}
          >
            <IconActivity size={24} />
          </div>
        </Group>
      </Card>

      {/* 4. Active Fleet Trips */}
      <Card
        p="md"
        radius="md"
        style={{
          backgroundColor: '#131e2b',
          border: '1px solid #1e2e3d',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Active Fleet Trips
            </Text>
            <Text fw={700} size="xl" mt={4} c="#f1f5f9">
              {metrics.totalActiveTrips.toLocaleString()}
            </Text>
            <Group gap="xs" mt="xs">
              <Badge
                size="xs"
                variant="light"
                color={metrics.delayedTripsCount > 0 ? 'orange' : 'teal'}
                leftSection={metrics.delayedTripsCount > 0 ? <IconAlertTriangle size={10} /> : <IconBus size={10} />}
              >
                {metrics.delayedTripsCount} delayed right now
              </Badge>
            </Group>
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              backgroundColor: '#1a2838',
              color: '#38bdf8',
            }}
          >
            <IconBus size={24} />
          </div>
        </Group>
      </Card>
    </SimpleGrid>
  );
}
