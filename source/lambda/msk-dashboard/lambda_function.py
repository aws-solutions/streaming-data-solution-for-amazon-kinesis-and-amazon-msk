######################################################################################################################
#  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

import boto3, collections, logging, json
from crhelper import CfnResource

client_cloudwatch = boto3.client('cloudwatch')
client_kafka = boto3.client('kafka')

helper = CfnResource(json_logging=True, log_level='INFO')
logger = logging.getLogger(__name__)

# Named tuple that contains some of the properties required to create a dashboard.
# The full schema is described here: https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/CloudWatch-Dashboard-Body-Structure.html
Widget = collections.namedtuple('Widget', [
    'metric_name', 'title',
    'x', 'y',
    'width', 'height',
    'region', 'stat', 'view',
    'number_nodes',
    'annotation'
])

def _generate_metrics_without_brokers(cluster_name, metric_name):
    return [['AWS/Kafka', metric_name, 'Cluster Name', cluster_name]]

def _generate_metrics_with_brokers(cluster_name, metric_name, number_nodes):
    return [
        # Broker IDs start at 1, so we need to use (x + 1)
        ['AWS/Kafka', metric_name, 'Cluster Name', cluster_name, 'Broker ID', str(x + 1)]
        for x in range(number_nodes)
    ]

def _get_cluster_details(cluster_arn):
    response = client_kafka.describe_cluster(ClusterArn=cluster_arn)
    return (
        response['ClusterInfo']['ClusterName'],
        response['ClusterInfo']['NumberOfBrokerNodes']
    )

def _create_title_widget(markdown_text):
    return {
        'type': 'text',
        'x': 0,
        'y': 0,
        'width': 24,
        'height': 1,
        'properties': {
            'markdown': markdown_text
        }
    }

def _create_metric_widget(widget, cluster_name):
    if widget.number_nodes is not None:
        metrics = _generate_metrics_with_brokers(cluster_name, widget.metric_name, widget.number_nodes)
    else:
        metrics = _generate_metrics_without_brokers(cluster_name, widget.metric_name)

    if widget.annotation is not None:
        label, value = widget.annotation
        annotations = {
            'horizontal': [{ 'label': label, 'value': value }]
        }
    else:
        annotations = None

    properties = {
        'metrics': metrics,
        'view': widget.view,
        'stacked': False,
        'region': widget.region,
        'stat': widget.stat,
        'period': 300,
        'title': widget.title,
        'annotations': annotations
    }

    # Remove None values from properties to prevent any warnings from the CloudWatch API
    filtered_props = { k: v for k, v in properties.items() if v is not None }

    return {
        'type': 'metric',
        'x': widget.x,
        'y': widget.y,
        'width': widget.width,
        'height': widget.height,
        'properties': filtered_props
    }

def _get_dashboard_body(region, cluster_name, number_nodes):
    widgets = []
    widgets.append(_create_title_widget('\n# MSK Cluster Metrics\n'))

    widget_spec = [
        Widget(
            metric_name='CpuUser',
            title='CPU (User) usage by broker',
            x=0, y=1,
            width=12, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='GlobalPartitionCount',
            title='Number of partitions across all brokers',
            x=12, y=1,
            width=6, height=3,
            region=region, stat='Maximum', view='singleValue',
            number_nodes=None,
            annotation=None
        ),
        Widget(
            metric_name='GlobalTopicCount',
            title='Number of topics across all brokers',
            x=18, y=1,
            width=6, height=3,
            region=region, stat='Maximum', view='singleValue',
            number_nodes=None,
            annotation=None
        ),
        Widget(
            metric_name='OfflinePartitionsCount',
            title='Number of partitions that are offline',
            x=12, y=4,
            width=6, height=3,
            region=region, stat='Maximum', view='singleValue',
            number_nodes=None,
            annotation=None
        ),
        Widget(
            metric_name='ZooKeeperRequestLatencyMsMean',
            title='Latency for ZooKeeper requests (p99)',
            x=18, y=4,
            width=6, height=3,
            region=region, stat='p99', view='singleValue',
            number_nodes=None,
            annotation=None
        ),
        Widget(
            metric_name='KafkaDataLogsDiskUsed',
            title='Disk usage by broker',
            x=0, y=7,
            width=12, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=('Maximum disk usage', 100)
        ),
        Widget(
            metric_name='MessagesInPerSec',
            title='Incoming messages by broker',
            x=12, y=7,
            width=12, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='UnderReplicatedPartitions',
            title='Under-replicated partitions by broker',
            x=0, y=13,
            width=12, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='BytesOutPerSec',
            title='Bytes sent by broker',
            x=12, y=13,
            width=6, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='BytesInPerSec',
            title='Bytes received by broker',
            x=18, y=13,
            width=6, height=6,
            region=region, stat='Maximum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='NetworkRxPackets',
            title='Network RX packets by broker',
            x=12, y=19,
            width=12, height=6,
            region=region, stat='Average', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='NetworkTxPackets',
            title='Network TX packets by broker',
            x=0, y=19,
            width=12, height=6,
            region=region, stat='Average', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='NetworkRxErrors',
            title='Network RX errors by broker',
            x=12, y=25,
            width=12, height=6,
            region=region, stat='Sum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
        Widget(
            metric_name='NetworkTxErrors',
            title='Network TX errors by broker',
            x=0, y=25,
            width=12, height=6,
            region=region, stat='Sum', view='timeSeries',
            number_nodes=number_nodes,
            annotation=None
        ),
    ]

    for item in widget_spec:
        widgets.append(_create_metric_widget(item, cluster_name))

    return { 'widgets': widgets }

@helper.create
@helper.update
def update_dashboard(event, _):
    resource_properties = event['ResourceProperties']
    region = resource_properties['Region']
    cluster_arn = resource_properties['ClusterArn']

    (cluster_name, number_of_nodes) = _get_cluster_details(cluster_arn)

    dashboard_body = _get_dashboard_body(region, cluster_name, number_of_nodes)
    response = client_cloudwatch.put_dashboard(
        DashboardName=resource_properties['DashboardName'],
        DashboardBody=json.dumps(dashboard_body)
    )
    logger.info(f'Response from put_dashboard API: {response}')

@helper.delete
def delete_dashboard(event, _):
    dashboard_name = event['ResourceProperties']['DashboardName']
    response = client_cloudwatch.delete_dashboards(DashboardNames=[dashboard_name])
    logger.info(f'Response from delete_dashboards API: {response}')

def handler(event, context):
    helper(event, context)
