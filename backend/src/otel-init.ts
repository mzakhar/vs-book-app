// Import this module before Express and other instrumented libraries.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
} from '@opentelemetry/semantic-conventions';

const serviceNameTrigger =
  process.env.VS_BOOK_APP_SERVICE_NAME || process.env.OTEL_SERVICE_NAME;

if (serviceNameTrigger) {
  const serviceName = process.env.VS_BOOK_APP_SERVICE_NAME || 'vs-book-app';

  // Agent runtimes can inject ambient OTEL settings. Keep app identity and
  // sampling independent from whichever process launched it.
  const sdkDisabled = process.env.OTEL_SDK_DISABLED;
  const otelServiceName = process.env.OTEL_SERVICE_NAME;
  const tracesSampler = process.env.OTEL_TRACES_SAMPLER;
  delete process.env.OTEL_SDK_DISABLED;
  delete process.env.OTEL_SERVICE_NAME;
  delete process.env.OTEL_TRACES_SAMPLER;

  try {
    const resource = defaultResource().merge(resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_NAMESPACE]: 'zakharhome',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
    }));

    const sdk = new NodeSDK({
      resource,
      sampler: new AlwaysOnSampler(),
      traceExporter: new OTLPTraceExporter(),
      metricReaders: [new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 15_000,
      })],
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      })],
    });

    sdk.start();
    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      try {
        await sdk.shutdown();
      } catch (error) {
        console.error('Failed to shut down OpenTelemetry:', error);
      } finally {
        process.exit(0);
      }
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } finally {
    if (sdkDisabled !== undefined) process.env.OTEL_SDK_DISABLED = sdkDisabled;
    if (otelServiceName !== undefined) process.env.OTEL_SERVICE_NAME = otelServiceName;
    if (tracesSampler !== undefined) process.env.OTEL_TRACES_SAMPLER = tracesSampler;
  }
}
