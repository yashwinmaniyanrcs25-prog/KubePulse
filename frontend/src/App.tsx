import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { OverviewPage } from './pages/OverviewPage';
import { WorkloadsPage } from './pages/WorkloadsPage';
import { DeployAppPage } from './pages/DeployAppPage';
import { PodsPage } from './pages/PodsPage';
import { ServicesPage } from './pages/ServicesPage';
import { HealthChecksPage } from './pages/HealthChecksPage';
import { EventsPage } from './pages/EventsPage';
import { DemoRunnerPage } from './pages/DemoRunnerPage';
import { DeploymentGuidePage } from './pages/DeploymentGuidePage';
import { SettingsPage } from './pages/SettingsPage';
import {
  NavTab,
  ClusterStatus,
  NamespaceItem,
  DeploymentItem,
  PodItem,
  ServiceItem,
  EventItem,
  MetricsResponse,
  RolloutStatus,
} from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
  const [namespaces, setNamespaces] = useState<NamespaceItem[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('kubepulse');
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [pods, setPods] = useState<PodItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [rolloutStatus, setRolloutStatus] = useState<RolloutStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [pollingInterval, setPollingInterval] = useState<number>(3000);

  // Fetch real Kubernetes data
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let statusData: ClusterStatus | null = null;
      try {
        statusData = await api.getClusterStatus();
      } catch (err: any) {
        statusData = {
          is_connected: false,
          cluster_status: 'disconnected',
          cluster_name: 'none',
          auth_type: 'none',
          current_context: undefined,
          node_count: 0,
          active_namespace: selectedNamespace,
          target_deployment: 'kubepulse-sample',
          reachable: false,
          error_details: err?.message || 'Cannot reach KubePulse API Gateway at /api/cluster/status (Port 8001). Check if backend is running.',
          message: 'Backend API Gateway or Kubernetes cluster is unreachable.',
          available_contexts: [],
        };
      }

      setClusterStatus(statusData);

      if (statusData && statusData.is_connected) {
        const [nsData, depData, podData, svcData, evtData, metricData] =
          await Promise.all([
            api.getNamespaces().catch(() => []),
            api.getDeployments(selectedNamespace).catch(() => []),
            api.getPods(selectedNamespace).catch(() => []),
            api.getServices(selectedNamespace).catch(() => []),
            api.getEvents(selectedNamespace).catch(() => []),
            api.getMetrics(selectedNamespace).catch(() => null),
          ]);

        if (nsData) setNamespaces(nsData);
        if (depData) setDeployments(depData);
        if (podData) setPods(podData);
        if (svcData) setServices(svcData);
        if (evtData) setEvents(evtData);
        if (metricData) setMetrics(metricData);

        // Fetch real rollout if target deployment exists
        const targetName = statusData?.target_deployment || 'kubepulse-sample';
        if (targetName) {
          api.getRolloutStatus(targetName, selectedNamespace)
            .then(setRolloutStatus)
            .catch(() => {});
        }
      } else {
        setDeployments([]);
        setPods([]);
        setServices([]);
        setEvents([]);
        setRolloutStatus(null);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching cluster data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedNamespace]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling loop with unmount cleanup
  useEffect(() => {
    if (pollingInterval <= 0) return;
    const interval = setInterval(() => {
      fetchData();
    }, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollingInterval]);

  // Real Actions
  const handleScaleDeployment = async (name: string, replicas: number) => {
    await api.scaleDeployment(name, replicas, selectedNamespace);
    await fetchData();
  };

  const handleDeletePod = async (podName: string) => {
    const res = await api.deletePod(podName, selectedNamespace);
    setTimeout(() => fetchData(), 1000);
    return res;
  };

  const isConnected = clusterStatus?.is_connected === true;

  return (
    <div className="flex h-screen bg-navy-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        clusterStatus={clusterStatus}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <TopNav
          clusterStatus={clusterStatus}
          namespaces={namespaces}
          selectedNamespace={selectedNamespace}
          onSelectNamespace={setSelectedNamespace}
          onRefresh={fetchData}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />

        {/* Scrollable Main View */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && (
              <OverviewPage
                clusterStatus={clusterStatus}
                deployments={deployments}
                pods={pods}
                events={events}
                metrics={metrics}
                onScaleQuick={(reps) =>
                  handleScaleDeployment(clusterStatus?.target_deployment || 'kubepulse-sample', reps)
                }
                onNavigate={setCurrentTab}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
              />
            )}

            {currentTab === 'workloads' && (
              <WorkloadsPage
                deployments={deployments}
                rolloutStatus={rolloutStatus}
                onScale={handleScaleDeployment}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
                isConnected={isConnected}
                onNavigate={setCurrentTab}
              />
            )}

            {currentTab === 'deploy' && (
              <DeployAppPage
                clusterStatus={clusterStatus}
                selectedNamespace={selectedNamespace}
                deployments={deployments}
                onRefresh={fetchData}
                onScale={handleScaleDeployment}
                onNavigate={setCurrentTab}
              />
            )}

            {currentTab === 'pods' && (
              <PodsPage
                pods={pods}
                targetDeployment={clusterStatus?.target_deployment || 'kubepulse-sample'}
                selectedNamespace={selectedNamespace}
                onDeletePod={handleDeletePod}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
                isConnected={isConnected}
              />
            )}

            {currentTab === 'services' && (
              <ServicesPage
                services={services}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
                isConnected={isConnected}
              />
            )}

            {currentTab === 'health' && (
              <HealthChecksPage
                pods={pods}
                deployment={deployments[0] || null}
                events={events}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
                isConnected={isConnected}
              />
            )}

            {currentTab === 'events' && (
              <EventsPage
                events={events}
                onRefresh={fetchData}
                isRefreshing={isRefreshing}
              />
            )}

            {currentTab === 'demo' && <DemoRunnerPage />}

            {currentTab === 'guide' && <DeploymentGuidePage />}

            {currentTab === 'settings' && (
              <SettingsPage
                clusterStatus={clusterStatus}
                pollingInterval={pollingInterval}
                onSetPollingInterval={setPollingInterval}
                onRefresh={fetchData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
