/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

exports.handler = async (event) => {
    console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

    for (const record of event.Records) {
        const payload = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
        console.log(`Decoded payload: ${payload}`);
    }

    return `Successfully processed ${event.Records.length} records.`;
};
