# Database Schema: `channeldetails` Collection

This collection is responsible for storing and managing the configurations of different communication channels (like Telegram and Discord) for various AI agent versions.

## Overview
- **Database:** MongoDB
- **Collection Name:** `channeldetails`
- **Purpose:** Links AI Agents (via `version_id`) to their respective bot tokens and webhook configurations securely.

---

## Complete JSON Schema

```json
{
  "_id": "ObjectId",
  "version_id": "String",
  "agent_id": "String | null",
  "org_id": "String",
  "telegram": {
    "botToken": "String (Encrypted)",
    "webhookUrl": "String",
    "webhookSet": "Boolean"
  },
  "discord": {
    "botToken": "String (Encrypted)",
    "chatThreads": "Object (Optional)"
  },
  "created_at": "Date",
  "updated_at": "Date"
}
```

---

## Key Descriptions and Use Cases

### Core Identifiers
| Key | Type | Requirement | Use Case |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | **Mandatory** | MongoDB's primary key for the document. Automatically generated. |
| `version_id` | String | **Mandatory** | The unique identifier linking this configuration to a specific deployment/version of an AI agent. *This field has a unique index.* |
| `agent_id` | String / null | Optional | The parent AI Agent ID. Useful for grouping or querying all channels belonging to an overarching agent. |
| `org_id` | String | **Mandatory** | Organization/Workspace identifier. Crucial for **multi-tenancy security** to ensure users only see their own organization's bot configurations. |

### Telegram Settings (`telegram`)
This object is created or updated when a user connects a Telegram bot.
| Key | Type | Requirement | Use Case |
| :--- | :--- | :--- | :--- |
| `botToken` | String | **Mandatory** | The Telegram bot token required to authenticate with the Telegram API. **It is stored securely using AES encryption.** |
| `webhookUrl` | String | Required | The destination URL where Telegram will route incoming messages for this bot. |
| `webhookSet` | Boolean | Required | Flag indicating whether the webhook has been successfully registered with Telegram's API. |

### Discord Settings (`discord`)
This object is created or updated when a user connects a Discord bot.
| Key | Type | Requirement | Use Case |
| :--- | :--- | :--- | :--- |
| `botToken` | String | **Mandatory** | The Discord bot token required to authenticate and connect to the Discord Gateway. **It is stored securely using AES encryption.** |
| `chatThreads` | Object | Optional | Stores historical chat thread data/IDs to maintain conversation context across Discord threads. |


### Timestamps
| Key | Type | Requirement | Use Case |
| :--- | :--- | :--- | :--- |
| `created_at` | Date | **Mandatory** | The exact timestamp when this channel configuration was first created. |
| `updated_at` | Date | **Mandatory** | The timestamp of the most recent modification. Used for sorting configurations (newest first). |

---

## Security Notes
> **IMPORTANT**: **Never store raw tokens.** The backend API endpoints (`/api/channel-details` and `/api/discord/setup`) actively use `encryptSecret` before saving any tokens to MongoDB, and `maskSecret` when returning data to the frontend for display.
