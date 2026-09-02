import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { copyFinalDist, downloadS3Folder } from "./aws";
import { buildProject } from "./build";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
dotenv.config();
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });
const docClient = DynamoDBDocumentClient.from(dynamo);

const tableName = process.env.AWS_DYNAMO_DB_NAME!;

const sqs = new SQSClient({ region: process.env.AWS_REGION! });
const queueUrl = process.env.AWS_SQS_QUEUE_URL!;

async function main() {
    while (true) { 
        const result = await sqs.send(new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20
        }));

        if (result.Messages?.[0]) {
            const message = result.Messages[0];
            // console.log(message.Body);
            const id = message.Body;
            // console.log(id);
            await sqs.send(new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle!
            }));
            await downloadS3Folder(`output/${id}`);
            try {
                const result = await buildProject(id || "");
                console.log("Build successful:", result);
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Build failed:", error.message);
                } else {
                    console.error("Build failed:", String(error));
                }
            }
            console.log("downloaded");
            await copyFinalDist(id || "");
            console.log("done");
            await dynamo.send(new UpdateItemCommand({
                TableName: tableName,
                Key: {
                    id: { S: id || "" }
                },
                UpdateExpression: "SET #status = :status",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": { S: "deployed" }
                }
            }));
        }
    }
}

main();