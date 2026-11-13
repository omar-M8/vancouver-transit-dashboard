import { Card, Text, Table, Badge, Group, Box } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useTransitStore } from '../stores/useTransitStore';

export function Leaderboard() {
  const { leaderboard } = useTransitStore();

  if (!leaderboard || leaderboard.length === 0) {
    return null;
  }

  return (
    <Card
      p="lg"
      radius="md"
      style={{
        backgroundColor: '#131e2b',
        border: '1px solid #1e2e3d',
      }}
    >
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={700} size="md" c="#f1f5f9">
            Route Punctuality Leaderboard
          </Text>
          <Text size="xs" c="dimmed">
            Top monitored corridors by reliability & trip activity
          </Text>
        </div>
        <Badge variant="outline" color="cyan" size="sm">
          Active TransLink Routes
        </Badge>
      </Group>

      <Table.ScrollContainer minWidth={480}>
        <Table verticalSpacing="xs" horizontalSpacing="md">
          <Table.Thead style={{ backgroundColor: '#16222f' }}>
            <Table.Tr>
              <Table.Th style={{ color: '#94a3b8' }}>RANK</Table.Th>
              <Table.Th style={{ color: '#94a3b8' }}>ROUTE</Table.Th>
              <Table.Th style={{ color: '#94a3b8' }}>AVG DELAY</Table.Th>
              <Table.Th style={{ color: '#94a3b8' }}>ACTIVE TRIPS</Table.Th>
              <Table.Th style={{ color: '#94a3b8' }}>% DELAYED</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {leaderboard.map((item) => (
              <Table.Tr key={item.routeId}>
                <Table.Td>
                  <Box
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor:
                        item.rank === 1
                          ? '#0284c7'
                          : item.rank === 2
                          ? '#0369a1'
                          : '#1e293b',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item.rank}
                  </Box>
                </Table.Td>
                <Table.Td>
                  <Badge variant="filled" color="cyan" size="sm" radius="xs">
                    Route {item.routeId}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <IconClock size={14} color="#38bdf8" />
                    <Text size="sm" c="#f1f5f9" fw={600}>
                      +{item.avgDelayMinutes.toFixed(1)} min
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="#94a3b8">
                    {item.activeTripsCount} trips
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    variant="light"
                    color={
                      item.percentDelayed < 20
                        ? 'teal'
                        : item.percentDelayed < 30
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {item.percentDelayed.toFixed(1)}%
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
