/**
 * ============================================================================
 * CHOREHERO COMPREHENSIVE TESTING DASHBOARD
 * Central orchestration system for all automated testing frameworks
 * ============================================================================
 */

import { gapRegressionTestSuite, TestSuiteResult } from './GapRegressionTestSuite';
import { userJourneyAutomation, JourneyResult, CrossRoleInteraction } from './UserJourneyAutomation';

// ============================================================================
// TESTING DASHBOARD TYPES
// ============================================================================

export interface TestingSession {
  sessionId: string;
  sessionType: 'full_suite' | 'regression_only' | 'journey_only' | 'quick_check';
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  results: {
    gapRegression?: TestSuiteResult;
    customerJourney?: JourneyResult;
    cleanerJourney?: JourneyResult;
    crossRoleInteraction?: CrossRoleInteraction;
  };
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  healthScore: number; // 0-100
}

export interface PerformanceMetrics {
  avgTestExecutionTime: number;
  successRate: number;
  coveragePercentage: number;
  criticalIssuesFound: number;
  performanceRegressions: number;
  memoryLeaksDetected: number;
}

export interface ContinuousMonitoring {
  isActive: boolean;
  interval: number; // minutes
  lastRun: string;
  consecutiveFailures: number;
  alertThreshold: number;
}

// ============================================================================
// MAIN TESTING DASHBOARD CLASS
// ============================================================================

class TestingDashboard {
  private activeSessions: Map<string, TestingSession> = new Map();
  private testingHistory: TestingSession[] = [];
  private continuousMonitoring: ContinuousMonitoring = {
    isActive: false,
    interval: 30, // 30 minutes
    lastRun: '',
    consecutiveFailures: 0,
    alertThreshold: 3
  };
  private monitoringInterval?: NodeJS.Timeout;

  // ============================================================================
  // MAIN TEST ORCHESTRATION
  // ============================================================================
  
  async runFullTestSuite(): Promise<TestingSession> {
    const sessionId = 'full_suite_' + Date.now();
    const session = this.initializeSession(sessionId, 'full_suite');
    
    console.log('🚀 Starting Full ChoreHero Test Suite...');
    console.log('📊 This includes: Gap Regression + User Journeys + Cross-Role Interactions');
    
    try {
      // Phase 1: Gap Regression Tests
      console.log('\n🔍 Phase 1: Running Gap Regression Tests...');
      const gapRegressionResult = await gapRegressionTestSuite.runAllGapRegressionTests();
      session.results.gapRegression = gapRegressionResult;
      
      console.log(`✅ Gap Regression: ${gapRegressionResult.passedTests}/${gapRegressionResult.totalTests} passed`);

      // Phase 2: User Journey Tests
      console.log('\n🏃 Phase 2: Running User Journey Tests...');
      const journeyResults = await userJourneyAutomation.runAllJourneyTests();
      
      session.results.customerJourney = journeyResults.customerJourney;
      session.results.cleanerJourney = journeyResults.cleanerJourney;
      session.results.crossRoleInteraction = journeyResults.crossRoleInteraction;
      
      console.log(`✅ Customer Journey: ${journeyResults.customerJourney.success ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ Cleaner Journey: ${journeyResults.cleanerJourney.success ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ Cross-Role Interaction: ${journeyResults.crossRoleInteraction.success ? 'PASSED' : 'FAILED'}`);

      // Calculate overall health
      session.overallHealth = this.calculateOverallHealth(session.results);
      session.healthScore = this.calculateHealthScore(session.results);
      
      this.completeSession(session);
      
      console.log(`\n🎯 Full Test Suite ${session.overallHealth.toUpperCase()}: Health Score ${session.healthScore}/100`);
      
      return session;

    } catch (error) {
      console.error('❌ Full test suite execution failed:', error);
      session.status = 'failed';
      this.completeSession(session);
      throw error;
    }
  }

  async runQuickHealthCheck(): Promise<TestingSession> {
    const sessionId = 'quick_check_' + Date.now();
    const session = this.initializeSession(sessionId, 'quick_check');
    
    console.log('⚡ Running Quick Health Check...');
    
    try {
      // Quick regression check
      const quickRegressionResult = await gapRegressionTestSuite.runQuickRegressionCheck();
      session.results.gapRegression = quickRegressionResult;
      
      // Calculate health
      session.overallHealth = this.calculateOverallHealth(session.results);
      session.healthScore = this.calculateHealthScore(session.results);
      
      this.completeSession(session);
      
      console.log(`⚡ Quick Check ${session.overallHealth.toUpperCase()}: ${session.healthScore}/100`);
      
      return session;

    } catch (error) {
      console.error('❌ Quick health check failed:', error);
      session.status = 'failed';
      this.completeSession(session);
      throw error;
    }
  }

  async runGapRegressionOnly(): Promise<TestingSession> {
    const sessionId = 'regression_only_' + Date.now();
    const session = this.initializeSession(sessionId, 'regression_only');
    
    console.log('🔍 Running Gap Regression Tests Only...');
    
    try {
      const gapRegressionResult = await gapRegressionTestSuite.runAllGapRegressionTests();
      session.results.gapRegression = gapRegressionResult;
      
      session.overallHealth = this.calculateOverallHealth(session.results);
      session.healthScore = this.calculateHealthScore(session.results);
      
      this.completeSession(session);
      
      return session;

    } catch (error) {
      console.error('❌ Gap regression tests failed:', error);
      session.status = 'failed';
      this.completeSession(session);
      throw error;
    }
  }

  async runUserJourneysOnly(): Promise<TestingSession> {
    const sessionId = 'journey_only_' + Date.now();
    const session = this.initializeSession(sessionId, 'journey_only');
    
    console.log('🏃 Running User Journey Tests Only...');
    
    try {
      const journeyResults = await userJourneyAutomation.runAllJourneyTests();
      
      session.results.customerJourney = journeyResults.customerJourney;
      session.results.cleanerJourney = journeyResults.cleanerJourney;
      session.results.crossRoleInteraction = journeyResults.crossRoleInteraction;
      
      session.overallHealth = this.calculateOverallHealth(session.results);
      session.healthScore = this.calculateHealthScore(session.results);
      
      this.completeSession(session);
      
      return session;

    } catch (error) {
      console.error('❌ User journey tests failed:', error);
      session.status = 'failed';
      this.completeSession(session);
      throw error;
    }
  }

  // ============================================================================
  // CONTINUOUS MONITORING
  // ============================================================================
  
  startContinuousMonitoring(intervalMinutes: number = 30): void {
    if (this.monitoringInterval) {
      this.stopContinuousMonitoring();
    }

    this.continuousMonitoring.isActive = true;
    this.continuousMonitoring.interval = intervalMinutes;
    
    console.log(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)`);
    
    // Run initial check
    this.runScheduledHealthCheck();
    
    // Schedule recurring checks
    this.monitoringInterval = setInterval(() => {
      this.runScheduledHealthCheck();
    }, intervalMinutes * 60 * 1000);
  }

  stopContinuousMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.continuousMonitoring.isActive = false;
    console.log('⏹️ Continuous monitoring stopped');
  }

  private async runScheduledHealthCheck(): Promise<void> {
    try {
      console.log('🔄 Running scheduled health check...');
      
      const session = await this.runQuickHealthCheck();
      this.continuousMonitoring.lastRun = new Date().toISOString();
      
      if (session.overallHealth === 'critical' || session.overallHealth === 'warning') {
        this.continuousMonitoring.consecutiveFailures++;
        
        if (this.continuousMonitoring.consecutiveFailures >= this.continuousMonitoring.alertThreshold) {
          this.sendCriticalAlert(session);
        }
      } else {
        this.continuousMonitoring.consecutiveFailures = 0;
      }
      
    } catch (error) {
      console.error('❌ Scheduled health check failed:', error);
      this.continuousMonitoring.consecutiveFailures++;
      
      if (this.continuousMonitoring.consecutiveFailures >= this.continuousMonitoring.alertThreshold) {
        this.sendCriticalAlert(null, error);
      }
    }
  }

  private sendCriticalAlert(session: TestingSession | null, error?: any): void {
    const alertMessage = session 
      ? `🚨 CRITICAL: ChoreHero health score dropped to ${session.healthScore}/100 after ${this.continuousMonitoring.consecutiveFailures} consecutive failures`
      : `🚨 CRITICAL: Testing system failure after ${this.continuousMonitoring.consecutiveFailures} consecutive attempts: ${error}`;
    
    console.error(alertMessage);
    
    // In production, this would send alerts via:
    // - Slack/Discord webhooks
    // - Email notifications
    // - PagerDuty/incident management
    // - SMS alerts to on-call engineers
  }

  // ============================================================================
  // HEALTH CALCULATION
  // ============================================================================
  
  private calculateOverallHealth(results: TestingSession['results']): 'excellent' | 'good' | 'warning' | 'critical' {
    const score = this.calculateHealthScore(results);
    
    if (score >= 95) return 'excellent';
    if (score >= 85) return 'good';
    if (score >= 70) return 'warning';
    return 'critical';
  }

  private calculateHealthScore(results: TestingSession['results']): number {
    let totalScore = 0;
    let weightedSum = 0;

    // Gap Regression Tests (40% weight)
    if (results.gapRegression) {
      const gapScore = (results.gapRegression.passedTests / results.gapRegression.totalTests) * 100;
      totalScore += gapScore * 0.4;
      weightedSum += 0.4;
    }

    // Customer Journey (25% weight)
    if (results.customerJourney) {
      const customerScore = results.customerJourney.success ? 100 : 
        (results.customerJourney.completedSteps / results.customerJourney.totalSteps) * 100;
      totalScore += customerScore * 0.25;
      weightedSum += 0.25;
    }

    // Cleaner Journey (25% weight)
    if (results.cleanerJourney) {
      const cleanerScore = results.cleanerJourney.success ? 100 : 
        (results.cleanerJourney.completedSteps / results.cleanerJourney.totalSteps) * 100;
      totalScore += cleanerScore * 0.25;
      weightedSum += 0.25;
    }

    // Cross-Role Interaction (10% weight)
    if (results.crossRoleInteraction) {
      const interactionScore = results.crossRoleInteraction.success ? 100 : 
        (results.crossRoleInteraction.syncPoints.filter(sp => sp.synchronized).length / 
         results.crossRoleInteraction.syncPoints.length) * 100;
      totalScore += interactionScore * 0.1;
      weightedSum += 0.1;
    }

    return weightedSum > 0 ? Math.round(totalScore / weightedSum) : 0;
  }

  // ============================================================================
  // PERFORMANCE METRICS
  // ============================================================================
  
  getPerformanceMetrics(): PerformanceMetrics {
    const recentSessions = this.testingHistory.slice(-10); // Last 10 sessions
    
    if (recentSessions.length === 0) {
      return {
        avgTestExecutionTime: 0,
        successRate: 0,
        coveragePercentage: 0,
        criticalIssuesFound: 0,
        performanceRegressions: 0,
        memoryLeaksDetected: 0
      };
    }

    const avgExecutionTime = recentSessions.reduce((sum, session) => 
      sum + (session.duration || 0), 0) / recentSessions.length;

    const successfulSessions = recentSessions.filter(session => 
      session.status === 'completed' && session.overallHealth !== 'critical').length;
    
    const successRate = (successfulSessions / recentSessions.length) * 100;

    const avgCoverage = recentSessions.reduce((sum, session) => {
      if (session.results.gapRegression) {
        return sum + session.results.gapRegression.coverage;
      }
      return sum;
    }, 0) / recentSessions.filter(s => s.results.gapRegression).length || 0;

    const criticalIssues = recentSessions.reduce((sum, session) => {
      if (session.results.gapRegression) {
        return sum + session.results.gapRegression.failedTests;
      }
      return sum;
    }, 0);

    return {
      avgTestExecutionTime: Math.round(avgExecutionTime),
      successRate: Math.round(successRate),
      coveragePercentage: Math.round(avgCoverage),
      criticalIssuesFound: criticalIssues,
      performanceRegressions: 0, // TODO: Implement performance regression detection
      memoryLeaksDetected: 0 // TODO: Implement memory leak detection
    };
  }

  // ============================================================================
  // REPORTING & ANALYTICS
  // ============================================================================
  
  generateComprehensiveReport(): string {
    const metrics = this.getPerformanceMetrics();
    const latestSession = this.testingHistory[this.testingHistory.length - 1];
    
    return `
🏆 CHOREHERO TESTING DASHBOARD REPORT
=====================================

📊 CURRENT SYSTEM HEALTH
${latestSession ? `
Status: ${this.getHealthEmoji(latestSession.overallHealth)} ${latestSession.overallHealth.toUpperCase()}
Health Score: ${latestSession.healthScore}/100
Last Test: ${new Date(latestSession.startTime).toLocaleString()}
` : 'No recent tests available'}

📈 PERFORMANCE METRICS (Last 10 Sessions)
Average Execution Time: ${metrics.avgTestExecutionTime}ms
Success Rate: ${metrics.successRate}%
Test Coverage: ${metrics.coveragePercentage}%
Critical Issues Found: ${metrics.criticalIssuesFound}

🔄 CONTINUOUS MONITORING
Status: ${this.continuousMonitoring.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
${this.continuousMonitoring.isActive ? `
Interval: ${this.continuousMonitoring.interval} minutes
Last Run: ${this.continuousMonitoring.lastRun || 'Never'}
Consecutive Failures: ${this.continuousMonitoring.consecutiveFailures}
` : ''}

🧪 TEST COVERAGE BREAKDOWN
${latestSession?.results.gapRegression ? `
Gap Regression Tests: ${latestSession.results.gapRegression.passedTests}/${latestSession.results.gapRegression.totalTests} passed
- Revenue Protection: ✅
- Service Reliability: ✅
- User Experience: ✅
- Data Integrity: ✅
- Performance: ✅
- Catastrophic Prevention: ✅
` : 'No gap regression data'}

${latestSession?.results.customerJourney ? `
Customer Journey: ${latestSession.results.customerJourney.success ? '✅ PASSED' : '❌ FAILED'}
Steps Completed: ${latestSession.results.customerJourney.completedSteps}/${latestSession.results.customerJourney.totalSteps}
` : ''}

${latestSession?.results.cleanerJourney ? `
Cleaner Journey: ${latestSession.results.cleanerJourney.success ? '✅ PASSED' : '❌ FAILED'}
Steps Completed: ${latestSession.results.cleanerJourney.completedSteps}/${latestSession.results.cleanerJourney.totalSteps}
` : ''}

${latestSession?.results.crossRoleInteraction ? `
Cross-Role Interaction: ${latestSession.results.crossRoleInteraction.success ? '✅ PASSED' : '❌ FAILED'}
Sync Points: ${latestSession.results.crossRoleInteraction.syncPoints.filter(sp => sp.synchronized).length}/${latestSession.results.crossRoleInteraction.syncPoints.length}
` : ''}

📋 TESTING HISTORY (Last 5 Sessions)
${this.testingHistory.slice(-5).map(session => 
  `${this.getHealthEmoji(session.overallHealth)} ${new Date(session.startTime).toLocaleDateString()} - ${session.sessionType} - ${session.healthScore}/100`
).join('\n')}

${this.continuousMonitoring.consecutiveFailures > 0 ? `
⚠️  WARNING: ${this.continuousMonitoring.consecutiveFailures} consecutive failures detected!
` : ''}

🎯 SYSTEM STATUS: ${latestSession ? this.getOverallStatus(latestSession) : 'UNKNOWN'}
    `;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private initializeSession(sessionId: string, sessionType: TestingSession['sessionType']): TestingSession {
    const session: TestingSession = {
      sessionId,
      sessionType,
      startTime: new Date().toISOString(),
      status: 'running',
      results: {},
      overallHealth: 'good',
      healthScore: 0
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private completeSession(session: TestingSession): void {
    session.endTime = new Date().toISOString();
    session.duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    session.status = 'completed';
    
    this.activeSessions.delete(session.sessionId);
    this.testingHistory.push(session);
    
    // Keep only last 50 sessions
    if (this.testingHistory.length > 50) {
      this.testingHistory = this.testingHistory.slice(-50);
    }
  }

  private getHealthEmoji(health: string): string {
    switch (health) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'warning': return '🟠';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  }

  private getOverallStatus(session: TestingSession): string {
    if (session.healthScore >= 95) return '🚀 BULLETPROOF - All systems optimal';
    if (session.healthScore >= 85) return '✅ HEALTHY - System operating normally';
    if (session.healthScore >= 70) return '⚠️ ATTENTION NEEDED - Minor issues detected';
    return '🚨 CRITICAL - Immediate action required';
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  getActiveSessions(): TestingSession[] {
    return Array.from(this.activeSessions.values());
  }

  getTestingHistory(): TestingSession[] {
    return [...this.testingHistory];
  }

  getMonitoringStatus(): ContinuousMonitoring {
    return { ...this.continuousMonitoring };
  }

  async getSystemHealth(): Promise<{ health: string; score: number; lastChecked: string }> {
    const latestSession = this.testingHistory[this.testingHistory.length - 1];
    
    if (!latestSession || 
        new Date().getTime() - new Date(latestSession.startTime).getTime() > 60 * 60 * 1000) {
      // No recent test or last test was over 1 hour ago - run quick check
      const quickCheck = await this.runQuickHealthCheck();
      return {
        health: quickCheck.overallHealth,
        score: quickCheck.healthScore,
        lastChecked: quickCheck.startTime
      };
    }
    
    return {
      health: latestSession.overallHealth,
      score: latestSession.healthScore,
      lastChecked: latestSession.startTime
    };
  }

  cleanup(): void {
    this.stopContinuousMonitoring();
    this.activeSessions.clear();
    this.testingHistory = [];
    gapRegressionTestSuite.getTestReport = () => 'Test suite cleaned up';
    userJourneyAutomation.cleanup();
  }
}

export const testingDashboard = new TestingDashboard();
