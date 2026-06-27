export class DeploymentOrchestrator {
  constructor({ requirementValidator, clusterManager, environmentManager, imageBuilder, deploymentManager, healthChecker, dataService }) {
    this.requirementValidator = requirementValidator;
    this.clusterManager = clusterManager;
    this.environmentManager = environmentManager;
    this.imageBuilder = imageBuilder;
    this.deploymentManager = deploymentManager;
    this.healthChecker = healthChecker;
    this.dataService = dataService;
  }

  record(name, result = {}) {
    return {
      name,
      status: result.warning ? 'WARN' : result.changed ? 'EXECUTED' : 'SKIPPED',
      message: result.message ?? '',
    };
  }

  runStep(steps, name, action, { mapResult } = {}) {
    this.onStep?.({ phase: 'start', name });
    try {
      const result = action();
      const step = mapResult ? mapResult(result) : this.record(name, result);
      steps.push(step);
      this.onStep?.({ phase: 'finish', ...step });
      return result;
    } catch (error) {
      this.onStep?.({ phase: 'error', name, message: error.message });
      throw error;
    }
  }

  run({ onStep, mineopsConfig = null } = {}) {
    this.onStep = onStep;
    this.mineopsConfig = mineopsConfig;
    const steps = [];

    const requirements = this.runStep(
      steps,
      'Validate requirements',
      () => this.requirementValidator.validate(mineopsConfig),
      { mapResult: (result) => ({ name: 'Validate requirements', status: 'OK', message: `${result.os}; ${result.commands.length} tools ready` }) },
    );

    this.runStep(steps, 'Prepare host environment', () => this.environmentManager.ensureHostDirectories(requirements.env, mineopsConfig));
    const clusterName = mineopsConfig?.cluster?.name;
    const cluster = this.runStep(steps, 'Create or reuse cluster', () => this.clusterManager.ensure({ env: requirements.env, clusterName }));

    const imageBuild = this.runStep(steps, 'Build Docker images', () => this.imageBuilder.buildIfNeeded());
    this.runStep(steps, 'Load Docker images', () => this.imageBuilder.loadIfNeeded({ force: imageBuild.changed || cluster.changed, clusterName }));

    const infrastructure = this.runStep(steps, 'Deploy Terraform resources', () => this.deploymentManager.applyInfrastructure(mineopsConfig));
    const runtimeConfig = this.runStep(steps, 'Inject runtime configuration', () => this.environmentManager.injectRuntimeConfig(mineopsConfig));
    const runtimeTimeZone = this.runStep(steps, 'Apply runtime timezone', () => this.deploymentManager.ensureRuntimeTimeZone(requirements.env.MINEOPS_TIME_ZONE, mineopsConfig));
    const manifests = this.runStep(steps, 'Deploy platform manifests', () => this.deploymentManager.applyManifests(mineopsConfig));
    const shouldWaitForWorkloads = cluster.changed
      || infrastructure.changed
      || imageBuild.changed
      || runtimeConfig.changed
      || runtimeTimeZone.changed
      || manifests.changed;
    this.runStep(steps, 'Wait for workloads', () => this.deploymentManager.waitForWorkloads({
      enabled: shouldWaitForWorkloads,
      restartDiscordBot: imageBuild.changed || runtimeConfig.changed,
      restartPlayit: runtimeConfig.changed,
      mineopsConfig,
    }));

    const health = this.runStep(
      steps,
      'Verify platform health',
      () => this.healthChecker.check(mineopsConfig),
      { mapResult: (result) => ({ name: 'Verify platform health', status: result.healthy ? 'OK' : 'WARN', message: result.healthy ? 'All workloads are healthy' : 'One or more workloads need attention' }) },
    );

    if (health.healthy) {
      this.dataService.appendEvent({ type: 'deployment', severity: 'INFO', message: 'MineOps initialized' });
    }

    return { steps, health };
  }
}
