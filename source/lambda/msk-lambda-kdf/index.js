/*********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const { FirehoseClient, PutRecordBatchCommand } = require('@aws-sdk/client-firehose');
const child_process = require('child_process');

// Each PutRecordBatch request supports up to 500 records or 4 MB
const FIREHOSE_MAX_RECORDS = 500;
const FIREHOSE_MAX_SIZE_BYTES = 4194304;
const FIREHOSE_RETRIES = 3;

// OS command does not accept any user input.
exports.sleep = (seconds) => child_process.execFileSync('sleep', [seconds]); // NOSONAR (javascript:S4721)

const _putRecords = async (records) => {
    const config = JSON.parse(process.env.AWS_SDK_USER_AGENT);
    const client = new FirehoseClient(config);
    const input = {
        DeliveryStreamName: process.env.DELIVERY_STREAM_NAME,
        Records: records
    };

    const command = new PutRecordBatchCommand(input);
    return client.send(command);
};

const _putRecordsBatch = async (records, batchNumber) => {
    let response = await _putRecords(records);
    let numberOfFailures = response.FailedPutCount;
    console.info(`[Batch #${batchNumber}] Successfully put ${response.RequestResponses.length - numberOfFailures} record(s)`);

    if (numberOfFailures === 0) {
        return;
    }

    let retryRecords = records;
    let retries = 0;

    do {
        /*
            For each retry, we only need to resend the requests that failed (this minimizes possible duplicates and also reduces the total bytes sent).
            Each entry in the RequestResponses array provides additional information about the processed record, and it correlates
            with a record in the request array using the same ordering, from the top to the bottom.
        */
        const retryBatch = [];
        for (let i = 0; i < response.RequestResponses.length; i++) {
            const errorCode = response.RequestResponses[i].ErrorCode;

            // Only include errors that are retryable.
            if (errorCode !== undefined && errorCode === 'ServiceUnavailableException') {
                retryBatch.push(retryRecords[i]);
            }
        }

        // A pseudorandom number generator can be used here.
        const secondsToWait = Math.floor(Math.random() * 5) + 1; // NOSONAR (javascript:S2245)
        console.info(`[Batch #${batchNumber}] Retry #${++retries}: Resending ${numberOfFailures} failed record(s) after ${secondsToWait} second(s)`);

        // Back off for a random value between 1 and 5 seconds
        this.sleep(secondsToWait);

        response = await _putRecords(retryBatch);

        /*
            If FailedPutCount is still greater than zero, we update the retryRecords array to only
            include the records which were sent in the previous `putRecordBatch` call (instead of all items
            in the original `records` parameter).
        */
        numberOfFailures = response.FailedPutCount;
        retryRecords = retryBatch;
    } while (retries < FIREHOSE_RETRIES && numberOfFailures > 0);

    if (numberOfFailures > 0) {
        console.warn(`[Batch #${batchNumber}] All retries exceeded: Could not send ${numberOfFailures} record(s)`);
    }
};

exports.handler = async (event, context) => {
    if (context) {
        console.log(`Received event: ${JSON.stringify(event, null, 2)}`);
    }

    let batchNumber = 0;
    let recordList = [];
    let sizeInBytes = 0;

    for (let key in event.records) {
        const filteredRecords = event.records[key].map(record => `${JSON.stringify(record)}\n`);

        for (const record of filteredRecords) {
            const size = Buffer.byteLength(record);

            if ((recordList.length + 1) > FIREHOSE_MAX_RECORDS || (sizeInBytes + size) > FIREHOSE_MAX_SIZE_BYTES) {
                batchNumber++;
                await _putRecordsBatch(recordList, batchNumber);

                recordList = [];
                sizeInBytes = 0;
            }

            recordList.push({ 'Data': Buffer.from(record).toString('base64') });
            sizeInBytes += size;
        }
    }

    if (recordList.length > 0) {
        batchNumber++;
        await _putRecordsBatch(recordList, batchNumber);
    }

    return batchNumber;
};
