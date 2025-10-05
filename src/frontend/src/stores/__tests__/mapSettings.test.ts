import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMapSettings } from '../mapSettings';

describe('useMapSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with clustering enabled by default', () => {
    const mapSettings = useMapSettings();
    expect(mapSettings.clusteringEnabled).toBe(true);
  });

  it('should toggle clustering state', () => {
    const mapSettings = useMapSettings();
    expect(mapSettings.clusteringEnabled).toBe(true);
    
    mapSettings.toggleClustering();
    expect(mapSettings.clusteringEnabled).toBe(false);
    
    mapSettings.toggleClustering();
    expect(mapSettings.clusteringEnabled).toBe(true);
  });

  it('should persist clustering state to localStorage', () => {
    const mapSettings = useMapSettings();
    
    mapSettings.toggleClustering();
    expect(localStorage.getItem('map_clustering_enabled')).toBe('false');
    
    mapSettings.toggleClustering();
    expect(localStorage.getItem('map_clustering_enabled')).toBe('true');
  });

  it('should load clustering state from localStorage on initialization', () => {
    // Set localStorage before creating store
    localStorage.setItem('map_clustering_enabled', 'false');
    
    // Create new pinia instance to trigger initialization
    setActivePinia(createPinia());
    const mapSettings = useMapSettings();
    
    expect(mapSettings.clusteringEnabled).toBe(false);
  });

  it('should set clustering enabled state directly', () => {
    const mapSettings = useMapSettings();
    
    mapSettings.setClusteringEnabled(false);
    expect(mapSettings.clusteringEnabled).toBe(false);
    expect(localStorage.getItem('map_clustering_enabled')).toBe('false');
    
    mapSettings.setClusteringEnabled(true);
    expect(mapSettings.clusteringEnabled).toBe(true);
    expect(localStorage.getItem('map_clustering_enabled')).toBe('true');
  });
});
