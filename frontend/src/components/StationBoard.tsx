import { useEffect, useState } from 'react';
import {
  Card,
  Combobox,
  Loader,
  useCombobox,
  Text,
  Group,
  TextInput,
  Button,
  Table,
  Badge,
  Stack,
  Paper,
  Box,
  Skeleton,
} from '@mantine/core';
import {
  IconSearch,
  IconMapPin,
  IconClock,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  useTransitStore,
  POPULAR_STATIONS,
  type StopSearchResult,
} from '../stores/useTransitStore';

const isStopCode = (text: string) => /^\d+$/.test(text);

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

/** The outcome of the last finished search, tagged with the query it answers */
interface SearchOutcome {
  query: string;
  status: 'done' | 'error';
  results: StopSearchResult[];
}

export function StationBoard() {
  const {
    selectedStopId,
    selectedStopName,
    departures,
    setSelectedStop,
    searchStops,
    isLoading,
  } = useTransitStore();

  // The box accepts either a stop code ("50915") or free text ("49th and fraser")
  const [query, setQuery] = useState(selectedStopId);
  const [debouncedQuery] = useDebouncedValue(query.trim(), 250);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const trimmedQuery = query.trim();
  const isTextSearch = trimmedQuery.length >= 2 && !isStopCode(trimmedQuery);
  const debouncedIsTextSearch = debouncedQuery.length >= 2 && !isStopCode(debouncedQuery);

  // Only trust results that answer the query currently in the box
  const outcomeIsCurrent = outcome !== null && outcome.query === debouncedQuery;
  const results = debouncedIsTextSearch && outcomeIsCurrent ? outcome.results : [];
  const searchStatus: SearchStatus = !debouncedIsTextSearch
    ? 'idle'
    : outcomeIsCurrent
      ? outcome.status
      : 'loading';

  // Text searches hit GET /stops/search; stop codes are looked up directly on submit
  useEffect(() => {
    if (!debouncedIsTextSearch) return;
    const controller = new AbortController();
    searchStops(debouncedQuery, controller.signal)
      .then((found) => {
        setOutcome({ query: debouncedQuery, status: 'done', results: found });
        combobox.selectFirstOption();
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setOutcome({ query: debouncedQuery, status: 'error', results: [] });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- combobox store is stable
  }, [debouncedQuery, debouncedIsTextSearch, searchStops]);

  const selectStop = (stopId: string, stopName: string) => {
    setQuery(stopId);
    combobox.closeDropdown();
    setSelectedStop(stopId, stopName);
  };

  const handleOptionSubmit = (optionValue: string) => {
    const preset = POPULAR_STATIONS.find((s) => `preset:${s.id}` === optionValue);
    if (preset) return selectStop(preset.id, preset.name);

    const match = results.find((r) => r.stop_id === optionValue);
    // /transit/{id} accepts the public stop code, or the GTFS stop_id when there isn't one
    if (match) selectStop(match.stop_code || match.stop_id, match.label);
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trimmedQuery) return;

    if (isStopCode(trimmedQuery)) {
      const match = POPULAR_STATIONS.find((s) => s.id === trimmedQuery);
      selectStop(trimmedQuery, match?.name || `Stop #${trimmedQuery}`);
      return;
    }

    // Free text: take the best match if the search has finished, otherwise show the list
    const resultsAreCurrent = debouncedQuery === trimmedQuery && searchStatus === 'done';
    if (resultsAreCurrent && results.length > 0) {
      handleOptionSubmit(results[0].stop_id);
    } else {
      combobox.openDropdown();
    }
  };

  const handleSelectPreset = (id: string, name: string) => {
    selectStop(id, name);
  };

  const renderDropdownContent = () => {
    if (!trimmedQuery) {
      return (
        <Combobox.Group label="Popular stations">
          {POPULAR_STATIONS.map((s) => (
            <Combobox.Option key={s.id} value={`preset:${s.id}`}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="xs">{s.name}</Text>
                <Text size="xs" c="dimmed">#{s.id}</Text>
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Group>
      );
    }
    if (!isTextSearch) return null;
    if (searchStatus === 'error') {
      return <Combobox.Empty>Search unavailable. Is the backend running?</Combobox.Empty>;
    }
    if (searchStatus === 'done' && results.length === 0) {
      return <Combobox.Empty>No stops match "{debouncedQuery}"</Combobox.Empty>;
    }
    return results.map((r) => (
      <Combobox.Option key={r.stop_id} value={r.stop_id}>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="xs">{r.label}</Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            #{r.stop_code || r.stop_id}
          </Text>
        </Group>
      </Combobox.Option>
    ));
  };

  const dropdownContent = renderDropdownContent();

  const formatDelay = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const remainingSecs = absSeconds % 60;
    const timeStr = mins > 0 ? `${mins}m ${remainingSecs}s` : `${remainingSecs}s`;

    if (seconds > 60) return `+${timeStr}`;
    if (seconds < -60) return `-${timeStr}`;
    return '0s';
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
      <Stack gap="md">
        {/* Top bar with Station search and title */}
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="xs">
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMapPin size={18} color="#ffffff" />
            </Box>
            <div>
              <Text fw={700} size="md" c="#f1f5f9">
                {selectedStopName}
              </Text>
              <Text size="xs" c="dimmed">
                Stop ID: #{selectedStopId} • {departures.length} active arrival estimate{departures.length === 1 ? '' : 's'}
              </Text>
            </div>
          </Group>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Combobox
              store={combobox}
              onOptionSubmit={handleOptionSubmit}
              position="bottom-end"
              width={360}
              styles={{
                dropdown: { backgroundColor: '#0f172a', borderColor: '#243547' },
                option: { color: '#f1f5f9' },
                groupLabel: { color: '#94a3b8' },
                empty: { color: '#94a3b8' },
              }}
            >
              <Combobox.Target>
                <TextInput
                  size="xs"
                  placeholder="Stop # or intersection (49th and fraser)"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.currentTarget.value);
                    combobox.openDropdown();
                    combobox.updateSelectedOptionIndex();
                  }}
                  onFocus={() => combobox.openDropdown()}
                  onClick={() => combobox.openDropdown()}
                  onBlur={() => combobox.closeDropdown()}
                  leftSection={<IconSearch size={14} />}
                  rightSection={
                    isTextSearch && (searchStatus === 'loading' || debouncedQuery !== trimmedQuery) ? (
                      <Loader size={12} color="cyan" />
                    ) : null
                  }
                  styles={{
                    input: {
                      backgroundColor: '#0f172a',
                      borderColor: '#243547',
                      color: '#f1f5f9',
                      width: 260,
                    },
                  }}
                />
              </Combobox.Target>

              <Combobox.Dropdown hidden={dropdownContent === null || (Array.isArray(dropdownContent) && dropdownContent.length === 0)}>
                <Combobox.Options mah={320} style={{ overflowY: 'auto' }}>
                  {dropdownContent}
                </Combobox.Options>
              </Combobox.Dropdown>
            </Combobox>
            <Button size="xs" color="cyan" type="submit" loading={isLoading}>
              Lookup
            </Button>
          </form>
        </Group>

        {/* Popular Station Quick Buttons */}
        <div>
          <Text size="xs" c="dimmed" mb={6} fw={600}>
            POPULAR STATIONS & HUBS:
          </Text>
          <Group gap="xs" wrap="wrap">
            {POPULAR_STATIONS.map((preset) => {
              const isSelected = preset.id === selectedStopId;
              return (
                <Button
                  key={preset.id}
                  size="compact-xs"
                  variant={isSelected ? 'filled' : 'subtle'}
                  color={isSelected ? 'cyan' : 'gray'}
                  onClick={() => handleSelectPreset(preset.id, preset.name)}
                  styles={{
                    root: {
                      border: isSelected ? 'none' : '1px solid #1e2e3d',
                      backgroundColor: isSelected ? undefined : '#0f172a',
                      color: isSelected ? undefined : '#94a3b8',
                    },
                  }}
                >
                  {preset.name} (#{preset.id})
                </Button>
              );
            })}
          </Group>
        </div>

        {/* Departures Table */}
        <Paper
          radius="md"
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e2e3d',
            overflow: 'hidden',
          }}
        >
          {isLoading && departures.length === 0 ? (
            <Stack p="md" gap="xs">
              <Skeleton height={35} radius="sm" />
              <Skeleton height={35} radius="sm" />
              <Skeleton height={35} radius="sm" />
            </Stack>
          ) : departures.length > 0 ? (
            <Table.ScrollContainer minWidth={580}>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead style={{ backgroundColor: '#16222f' }}>
                  <Table.Tr>
                    <Table.Th style={{ color: '#94a3b8' }}>ROUTE</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>TRIP ID</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>STOP SEQ</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>ESTIMATED DELAY</Table.Th>
                    <Table.Th style={{ color: '#94a3b8' }}>STATUS</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {departures.map((dep, idx) => {
                    const isLate = dep.status === 'LATE';
                    const isEarly = dep.status === 'EARLY';

                    return (
                      <Table.Tr key={`${dep.tripId}-${idx}`}>
                        <Table.Td>
                          <Badge
                            size="md"
                            variant="filled"
                            color={
                              dep.routeId.includes('99') || dep.routeId.startsWith('R')
                                ? 'teal'
                                : 'blue'
                            }
                            radius="sm"
                            fw={700}
                          >
                            {dep.routeId}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace" c="#94a3b8">
                            {dep.tripId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="#f1f5f9">
                            #{dep.stopSequence}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <IconClock
                              size={14}
                              color={isLate ? '#f87171' : isEarly ? '#60a5fa' : '#34d399'}
                            />
                            <Text
                              size="sm"
                              fw={600}
                              c={isLate ? '#f87171' : isEarly ? '#60a5fa' : '#34d399'}
                            >
                              {formatDelay(dep.delaySeconds)}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            variant="light"
                            color={isLate ? 'red' : isEarly ? 'blue' : 'teal'}
                            leftSection={
                              isLate ? (
                                <IconAlertTriangle size={12} />
                              ) : (
                                <IconCheck size={12} />
                              )
                            }
                          >
                            {dep.status === 'ON_TIME'
                              ? 'ON TIME'
                              : dep.status === 'LATE'
                              ? 'DELAYED'
                              : 'EARLY'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Box p="xl" style={{ textAlign: 'center' }}>
              <Text size="md" fw={600} c="#94a3b8" mb="xs">
                No active arrivals broadcasting for stop #{selectedStopId} right now
              </Text>
              <Text size="xs" c="dimmed" mb="md" maw={450} mx="auto">
                TransLink GTFS-RT only broadcasts vehicles that are actively approaching or scheduled within the immediate real-time window. Try selecting a major hub like Broadway & Cambie or Burrard Station.
              </Text>
              <Button
                size="xs"
                variant="light"
                color="cyan"
                onClick={() => setSelectedStop('50915', 'Broadway & Cambie')}
              >
                Switch to Broadway & Cambie (#50915)
              </Button>
            </Box>
          )}
        </Paper>
      </Stack>
    </Card>
  );
}
