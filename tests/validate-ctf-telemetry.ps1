param(
    [string]$TelemetryPath = (Join-Path $PSScriptRoot '..\data\ctf\telemetry.json'),
    [string]$ManifestPath = (Join-Path $PSScriptRoot '..\data\ctf\evidence-manifest.json'),
    [string]$ScenarioPath = (Join-Path $PSScriptRoot '..\data\ctf\scenario.js'),
    [string]$IncidentScenarioPath = (Join-Path $PSScriptRoot '..\data\ctf\incident-response.js'),
    [string]$EventEvidenceMapPath = (Join-Path $PSScriptRoot '..\data\ctf\event-evidence-map.json')
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Test-DocumentationIp {
    param([AllowNull()][object]$Address)

    if ($null -eq $Address -or [string]::IsNullOrWhiteSpace([string]$Address)) {
        return $true
    }

    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse([string]$Address, [ref]$parsed)) {
        return $false
    }

    $bytes = $parsed.GetAddressBytes()
    if ($bytes.Count -ne 4) {
        return $false
    }

    return (
        ($bytes[0] -eq 192 -and $bytes[1] -eq 0 -and $bytes[2] -eq 2) -or
        ($bytes[0] -eq 198 -and $bytes[1] -eq 51 -and $bytes[2] -eq 100) -or
        ($bytes[0] -eq 203 -and $bytes[1] -eq 0 -and $bytes[2] -eq 113)
    )
}

function Test-FictionalHostname {
    param([string]$Hostname)
    return $Hostname -match '^(?:[a-z0-9-]+\.)+invalid$'
}

function Get-DuplicateValues {
    param([object[]]$Values)
    return @($Values | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
}

try {
    $telemetry = Get-Content -Raw -Encoding utf8 -LiteralPath $TelemetryPath | ConvertFrom-Json
    $manifest = Get-Content -Raw -Encoding utf8 -LiteralPath $ManifestPath | ConvertFrom-Json
    $scenarioText = Get-Content -Raw -Encoding utf8 -LiteralPath $ScenarioPath
    $incidentScenarioText = Get-Content -Raw -Encoding utf8 -LiteralPath $IncidentScenarioPath
    $eventEvidenceMap = Get-Content -Raw -Encoding utf8 -LiteralPath $EventEvidenceMapPath | ConvertFrom-Json
} catch {
    Write-Error "Unable to read or parse telemetry inputs: $($_.Exception.Message)"
    exit 1
}

function Get-SectionIds {
    param(
        [string]$Text,
        [string]$StartPattern,
        [string]$EndPattern
    )
    $section = [regex]::Match($Text, "$StartPattern(.*?)$EndPattern", [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $section.Success) {
        return @()
    }
    return @([regex]::Matches($section.Groups[1].Value, 'id:\s*"([a-z][a-z0-9_]*)"') | ForEach-Object { $_.Groups[1].Value })
}

$requiredDatasets = @(
    'ngfw.audit',
    'ngfw.config',
    'identity.auth',
    'network.flow',
    'esxi.auth',
    'esxi.host-management',
    'vcenter.tasks',
    'vm.lifecycle',
    'windows.security',
    'edr.alert',
    'dns.query',
    'case.change-record'
)

$requiredFields = @(
    'event_id',
    'timestamp',
    'scenario_stage',
    'synthetic',
    'dataset',
    'hostname',
    'actor_alias',
    'action',
    'outcome',
    'source_ip',
    'destination_ip',
    'severity',
    'session_id',
    'task_id',
    'vm_id',
    'correlation_id',
    'node_refs',
    'message'
)

$events = @($telemetry.events)
if ($events.Count -lt 120 -or $events.Count -gt 180) {
    Add-Failure "Event count $($events.Count) is outside the required 120-180 range."
}

$eventIds = @($events | ForEach-Object event_id)
foreach ($duplicate in (Get-DuplicateValues $eventIds)) {
    Add-Failure "Duplicate event ID: $duplicate"
}

$eventById = @{}
foreach ($event in $events) {
    if (-not $eventById.ContainsKey($event.event_id)) {
        $eventById[$event.event_id] = $event
    }
}

$nodeSection = [regex]::Match($scenarioText, 'nodes:\s*\[(.*?)\],\s*choices:\s*\[', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $nodeSection.Success) {
    Add-Failure 'Could not locate the scenario node catalog.'
    $knownNodeIds = @{}
} else {
    $knownNodeIds = @{}
    foreach ($match in ([regex]::Matches($nodeSection.Groups[1].Value, 'id:\s*.([a-z][a-z0-9_]*)'))) {
        $knownNodeIds[$match.Groups[1].Value] = $true
    }
}

$incidentNodeIds = Get-SectionIds -Text $incidentScenarioText -StartPattern 'nodes:\s*\[' -EndPattern '\],\s*choices:\s*\['
$threatEvidenceIds = Get-SectionIds -Text $scenarioText -StartPattern 'records:\s*\[' -EndPattern '\],\s*\};'
$incidentEvidenceIds = Get-SectionIds -Text $incidentScenarioText -StartPattern 'records:\s*\[' -EndPattern '\],\s*\};'
$allKnownNodeIds = @{}
foreach ($nodeId in @($knownNodeIds.Keys + $incidentNodeIds)) {
    $allKnownNodeIds[$nodeId] = $true
}
$allEvidenceIds = @($threatEvidenceIds + $incidentEvidenceIds)

$previousTime = $null
for ($index = 0; $index -lt $events.Count; $index += 1) {
    $event = $events[$index]
    $path = "events[$index]"
    $propertyNames = @($event.PSObject.Properties.Name)

    foreach ($field in $requiredFields) {
        if ($propertyNames -notcontains $field) {
            Add-Failure "$path is missing required field $field."
        }
    }

    if ($event.synthetic -ne $true) {
        Add-Failure "$path is not marked synthetic."
    }
    if ($requiredDatasets -notcontains $event.dataset) {
        Add-Failure "$path uses unknown dataset $($event.dataset)."
    }
    if (-not (Test-FictionalHostname $event.hostname)) {
        Add-Failure "$path uses invalid hostname $($event.hostname)."
    }
    if (-not (Test-DocumentationIp $event.source_ip)) {
        Add-Failure "$path uses non-documentation source IP $($event.source_ip)."
    }
    if (-not (Test-DocumentationIp $event.destination_ip)) {
        Add-Failure "$path uses non-documentation destination IP $($event.destination_ip)."
    }
    if ($event.message -match '[<>]|[a-z][a-z0-9+.-]*://|(?i)\b(command|payload|credential|password|token|hash|api call|cve-[0-9]+)\b') {
        Add-Failure "$path contains prohibited operational or executable-style message content."
    }
    if (@($event.node_refs).Count -lt 1) {
        Add-Failure "$path has no scenario node reference."
    }
    foreach ($nodeRef in @($event.node_refs)) {
        if (-not $knownNodeIds.ContainsKey($nodeRef)) {
            Add-Failure "$path references unknown scenario node $nodeRef."
        }
    }

    # Timestamps must be UTC (a trailing 'Z' in the source JSON). We accept the
    # value however ConvertFrom-Json hands it back: Windows PowerShell 5.1 keeps
    # JSON date strings as [string], while PowerShell 7 auto-parses ISO-8601
    # strings into [datetime] (where a 'Z' becomes Kind=Utc). Checking only the
    # raw string with '-match Z$' silently fails every record under pwsh 7.
    $rawTimestamp = $event.timestamp
    $isUtcInstant = $false
    $parsedTime = [DateTimeOffset]::MinValue
    if ($rawTimestamp -is [datetime]) {
        if ($rawTimestamp.Kind -eq [System.DateTimeKind]::Utc) {
            $isUtcInstant = $true
            $parsedTime = [System.DateTimeOffset]::new($rawTimestamp)
        }
    } elseif ($rawTimestamp -is [string] -and $rawTimestamp -match 'Z$') {
        $isUtcInstant = [System.DateTimeOffset]::TryParse($rawTimestamp, [ref]$parsedTime)
    }
    if (-not $isUtcInstant) {
        Add-Failure "$path has an invalid UTC timestamp $($event.timestamp)."
    } elseif ($null -ne $previousTime -and $parsedTime -lt $previousTime) {
        Add-Failure "$path is out of timestamp order."
    } else {
        $previousTime = $parsedTime
    }
}

foreach ($dataset in $requiredDatasets) {
    if (@($events | Where-Object dataset -eq $dataset).Count -eq 0) {
        Add-Failure "Required dataset $dataset has no events."
    }
}

$benignCount = @($events | Where-Object activity_class -eq 'benign').Count
$signalCount = @($events | Where-Object activity_class -eq 'scenario_signal').Count
$benignPercentage = if ($events.Count -eq 0) { 0 } else { [math]::Round(($benignCount * 100.0) / $events.Count, 1) }
if ($benignPercentage -lt 62 -or $benignPercentage -gt 68) {
    Add-Failure "Benign percentage $benignPercentage is not approximately 65%."
}
if ($telemetry.metadata.event_count -ne $events.Count -or
    $telemetry.metadata.benign_event_count -ne $benignCount -or
    $telemetry.metadata.scenario_signal_count -ne $signalCount -or
    $telemetry.metadata.benign_percentage -ne $benignPercentage) {
    Add-Failure 'Telemetry metadata counts do not match event contents.'
}
if ($events.Count -gt 0 -and
    ($telemetry.metadata.timeline_start -ne $events[0].timestamp -or
     $telemetry.metadata.timeline_end -ne $events[-1].timestamp)) {
    Add-Failure 'Timeline metadata does not match the first and last normalized timestamps.'
}

foreach ($clock in @($telemetry.metadata.clock_skew)) {
    if (-not (Test-FictionalHostname $clock.hostname)) {
        Add-Failure "Clock-skew entry uses invalid hostname $($clock.hostname)."
    }
    if ($clock.normalization -ne 'offset_removed_before_packaging') {
        Add-Failure "Clock-skew entry for $($clock.hostname) lacks the approved normalization label."
    }
}

$sessionRegistry = @{}
foreach ($session in @($telemetry.identifier_registry.sessions)) {
    if ($sessionRegistry.ContainsKey($session.session_id)) {
        Add-Failure "Duplicate session registry ID $($session.session_id)."
    } else {
        $sessionRegistry[$session.session_id] = $session
    }
}

$taskRegistry = @{}
foreach ($task in @($telemetry.identifier_registry.tasks)) {
    if ($taskRegistry.ContainsKey($task.task_id)) {
        Add-Failure "Duplicate task registry ID $($task.task_id)."
    } else {
        $taskRegistry[$task.task_id] = $task
    }
}

$vmRegistry = @{}
foreach ($vm in @($telemetry.identifier_registry.vms)) {
    if ($vmRegistry.ContainsKey($vm.vm_id)) {
        Add-Failure "Duplicate VM registry ID $($vm.vm_id)."
    } elseif (-not (Test-FictionalHostname $vm.hostname)) {
        Add-Failure "VM registry ID $($vm.vm_id) uses invalid hostname $($vm.hostname)."
    } else {
        $vmRegistry[$vm.vm_id] = $vm
    }
}

foreach ($event in $events) {
    if ($null -ne $event.session_id) {
        if (-not $sessionRegistry.ContainsKey($event.session_id)) {
            Add-Failure "$($event.event_id) references unknown session $($event.session_id)."
        } else {
            $session = $sessionRegistry[$event.session_id]
            if ($event.actor_alias -ne $session.actor_alias -or $event.correlation_id -ne $session.correlation_id) {
                Add-Failure "$($event.event_id) is inconsistent with session $($event.session_id)."
            }
        }
    }
    if ($null -ne $event.task_id) {
        if (-not $taskRegistry.ContainsKey($event.task_id)) {
            Add-Failure "$($event.event_id) references unknown task $($event.task_id)."
        } else {
            $task = $taskRegistry[$event.task_id]
            if ($event.correlation_id -ne $task.correlation_id -or $event.vm_id -ne $task.vm_id) {
                Add-Failure "$($event.event_id) is inconsistent with task $($event.task_id)."
            }
        }
    }
    if ($null -ne $event.vm_id) {
        if (-not $vmRegistry.ContainsKey($event.vm_id)) {
            Add-Failure "$($event.event_id) references unknown VM $($event.vm_id)."
        } elseif ($event.dataset -in @('vm.lifecycle', 'windows.security', 'edr.alert')) {
            if ($event.hostname -ne $vmRegistry[$event.vm_id].hostname) {
                Add-Failure "$($event.event_id) hostname is inconsistent with VM $($event.vm_id)."
            }
        }
    }
}

$artifactIds = @($manifest.artifacts | ForEach-Object artifact_id)
foreach ($duplicate in (Get-DuplicateValues $artifactIds)) {
    Add-Failure "Duplicate artifact ID: $duplicate"
}
if ($manifest.metadata.artifact_count -ne @($manifest.artifacts).Count) {
    Add-Failure 'Manifest artifact count does not match artifact contents.'
}

foreach ($artifact in @($manifest.artifacts)) {
    $primaryIds = @($artifact.primary_event_ids)
    $corroboratingIds = @($artifact.corroborating_event_ids)
    $distractorIds = @($artifact.distractor_event_ids)
    if ($primaryIds.Count -lt 1 -or $corroboratingIds.Count -lt 1) {
        Add-Failure "$($artifact.artifact_id) lacks a primary or corroborating signal."
        continue
    }

    foreach ($eventId in @($primaryIds + $corroboratingIds + $distractorIds)) {
        if (-not $eventById.ContainsKey($eventId)) {
            Add-Failure "$($artifact.artifact_id) references unknown event $eventId."
        }
    }
    foreach ($nodeRef in @($artifact.node_refs)) {
        if (-not $knownNodeIds.ContainsKey($nodeRef)) {
            Add-Failure "$($artifact.artifact_id) references unknown node $nodeRef."
        }
    }

    if (@($primaryIds | Where-Object { $eventById.ContainsKey($_) -and $eventById[$_].finding_role -ne 'primary' }).Count -gt 0) {
        Add-Failure "$($artifact.artifact_id) has an event not marked as a primary signal."
    }
    if (@($corroboratingIds | Where-Object { $eventById.ContainsKey($_) -and $eventById[$_].finding_role -ne 'corroborating' }).Count -gt 0) {
        Add-Failure "$($artifact.artifact_id) has an event not marked as corroborating."
    }
    if (@($distractorIds | Where-Object { $eventById.ContainsKey($_) -and ($eventById[$_].finding_role -ne 'distractor' -or $eventById[$_].activity_class -ne 'benign') }).Count -gt 0) {
        Add-Failure "$($artifact.artifact_id) has a distractor that is not plausible benign activity."
    }

    $primaryDatasets = @($primaryIds | Where-Object { $eventById.ContainsKey($_) } | ForEach-Object { $eventById[$_].dataset } | Select-Object -Unique)
    $corroboratingDatasets = @($corroboratingIds | Where-Object { $eventById.ContainsKey($_) } | ForEach-Object { $eventById[$_].dataset } | Select-Object -Unique)
    if (@($corroboratingDatasets | Where-Object { $primaryDatasets -notcontains $_ }).Count -lt 1) {
        Add-Failure "$($artifact.artifact_id) lacks corroboration from another dataset."
    }

    $primaryCorrelations = @($primaryIds | Where-Object { $eventById.ContainsKey($_) } | ForEach-Object { $eventById[$_].correlation_id } | Where-Object { $null -ne $_ })
    $corroboratingCorrelations = @($corroboratingIds | Where-Object { $eventById.ContainsKey($_) } | ForEach-Object { $eventById[$_].correlation_id } | Where-Object { $null -ne $_ })
    if (@($primaryCorrelations | Where-Object { $corroboratingCorrelations -contains $_ }).Count -lt 1) {
        Add-Failure "$($artifact.artifact_id) primary and corroborating signals lack a shared correlation ID."
    }
}

$mappings = @($eventEvidenceMap.mappings)
if ($eventEvidenceMap.metadata.schema_version -ne 1) {
    Add-Failure 'Event-to-evidence mapping uses an unsupported schema version.'
}
if ($eventEvidenceMap.metadata.synthetic -ne $true) {
    Add-Failure 'Event-to-evidence mapping is not marked synthetic.'
}
if ($eventEvidenceMap.metadata.mapping_count -ne $mappings.Count) {
    Add-Failure 'Event-to-evidence mapping count does not match its metadata.'
}
$mappedEvidenceIds = @($mappings | ForEach-Object evidence_id)
foreach ($duplicate in (Get-DuplicateValues $mappedEvidenceIds)) {
    Add-Failure "Duplicate event-to-evidence mapping for $duplicate."
}
foreach ($mapping in $mappings) {
    if ($allEvidenceIds -notcontains $mapping.evidence_id) {
        Add-Failure "Event mapping references unknown evidence $($mapping.evidence_id)."
    }
    if (@($mapping.event_ids).Count -lt 1) {
        Add-Failure "Evidence $($mapping.evidence_id) has no mapped synthetic event."
    }
    foreach ($eventId in @($mapping.event_ids)) {
        if (-not $eventById.ContainsKey($eventId)) {
            Add-Failure "Evidence $($mapping.evidence_id) references unknown event $eventId."
        }
    }
    if (@($mapping.node_ids).Count -lt 1) {
        Add-Failure "Evidence $($mapping.evidence_id) has no mapped learner node."
    }
    foreach ($nodeId in @($mapping.node_ids)) {
        if (-not $allKnownNodeIds.ContainsKey($nodeId)) {
            Add-Failure "Evidence $($mapping.evidence_id) references unknown learner node $nodeId."
        }
    }
}
foreach ($evidenceId in $allEvidenceIds) {
    if ($mappedEvidenceIds -notcontains $evidenceId) {
        Add-Failure "Evidence $evidenceId has no event-to-evidence mapping."
    }
}

if ($failures.Count -gt 0) {
    Write-Host "CTF telemetry validation failed with $($failures.Count) issue(s):" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host 'CTF telemetry validation passed.' -ForegroundColor Green
Write-Host ('Events: {0}' -f $events.Count)
Write-Host ('Benign: {0} ({1} percent)' -f $benignCount, $benignPercentage)
Write-Host ('Scenario signals: {0}' -f $signalCount)
Write-Host ('Datasets: {0}' -f $requiredDatasets.Count)
Write-Host ('Evidence artifacts: {0}' -f @($manifest.artifacts).Count)
Write-Host ('Timeline: {0} through {1} UTC-normalized' -f $telemetry.metadata.timeline_start, $telemetry.metadata.timeline_end)
