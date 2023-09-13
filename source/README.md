# CDK project
This solution uses the AWS CDK to create the necessary AWS resources, and the top-level stacks are defined in the `patterns` folder.

## Using individual constructs
Each construct can be found in the `lib` folder, and they can be used separately of the solution. For instance, let's walk through an example where there's already an existing AWS Lambda function that processes records from an Amazon Kinesis data stream, but there are no alarms or monitoring configured.

> **Note**: The construct for Lambda and Kinesis monitoring is defined on [kds-monitoring.ts](lib/kds-monitoring.ts) , and it extends [monitoring-base.ts](lib/monitoring-base.ts).

### 1. Modify the alarm thresholds
After reviewing the defaults, we decide to change some of the thresholds to be more aligned with our use case.

```diff
-private readonly KDS_READ_WRITE_PROVISIONED_THRESHOLD: number = 0.01;
+private readonly KDS_READ_WRITE_PROVISIONED_THRESHOLD: number = 0.05;

-private readonly KDS_PUT_RECORDS_THRESHOLD: number = 0.95;
+private readonly KDS_PUT_RECORDS_THRESHOLD: number = 0.90;
```

### 2. (Optional) Add more alarms
By default, the construct will add all metrics listed as recommended in the [developer guide](https://docs.aws.amazon.com/streams/latest/dev/monitoring-with-cloudwatch.html#kinesis-metric-use), but we can also add others (such as _IncomingBytes_).

### 3. Create a stack definition
We'll create a new stack class (in the `patterns` folder) to use the modified version of the `DataStreamMonitoring` construct.

```typescript
import * as cdk  from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStreamMonitoring } from '../lib/kds-monitoring';

export class StreamingMonitoringStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const streamName = new cdk.CfnParameter(this, 'StreamName');
        const lambdaFnName = new cdk.CfnParameter(this, 'FunctionName');

        new DataStreamMonitoring(this, 'Monitoring', {
            streamName: streamName.valueAsString,
            lambdaFunctionName: lambdaFnName.valueAsString
        });
    }
}
```

### 4. Modify the application entrypoint
We'll also modify the entrypoint file (`bin/streaming-data-solution.ts`) so that only the new stack is included as part of the application:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk  from 'aws-cdk-lib';

import { StreamingMonitoringStack } from '../patterns/streaming-monitoring-stack';
const app = new cdk.App();

new StreamingMonitoringStack(app, 'MonitoringStack');
```

### 5. Prepare the stack for deployment
Once our changes are complete, we can build the project and generate the CloudFormation template.

```
npm run build
cdk synth > monitoring-template.yaml
```
