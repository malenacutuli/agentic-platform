/**
 * Example client code for using the Agentic Platform
 */

const API_URL = "http://localhost:3000/api";

/**
 * Example 1: Generate a new project
 */
async function generateProject() {
  console.log("📦 Generating new project...");

  const response = await fetch(`${API_URL}/projects/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectName: "my-ai-startup",
      template: "web-ai-agent",
      owner: {
        userId: "user_123",
        email: "founder@startup.com",
        name: "Jane Doe",
      },
      features: ["ai", "database", "storage"],
    }),
  });

  const data = await response.json();
  console.log("✅ Project generated:", data);
  return data;
}

/**
 * Example 2: Create a sandbox for the project
 */
async function createSandbox(projectId: string, projectPath: string) {
  console.log("🐳 Creating sandbox...");

  const response = await fetch(`${API_URL}/sandboxes/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      projectPath,
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        NODE_ENV: "development",
      },
    }),
  });

  const data = await response.json();
  console.log("✅ Sandbox created:", data);
  return data;
}

/**
 * Example 3: Get LLM completion (non-streaming)
 */
async function getLLMCompletion() {
  console.log("🤖 Getting LLM completion...");

  const response = await fetch(`${API_URL}/llm/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You are an expert software architect.",
        },
        {
          role: "user",
          content:
            "Design a scalable microservices architecture for an e-commerce platform.",
        },
      ],
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 1000,
    }),
  });

  const data = await response.json();
  console.log("✅ LLM Response:");
  console.log(data.choices[0].message.content);
  return data;
}

/**
 * Example 4: Stream LLM completion
 */
async function streamLLMCompletion() {
  console.log("🤖 Streaming LLM completion...");

  const response = await fetch(`${API_URL}/llm/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Write a short poem about artificial intelligence",
        },
      ],
      model: "gpt-4",
      stream: true,
    }),
  });

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  console.log("📝 Poem:");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "content") {
            process.stdout.write(data.content);
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    }
  }

  console.log("\n✅ Streaming complete");
}

/**
 * Example 5: Check LLM router status
 */
async function checkLLMStatus() {
  console.log("📊 Checking LLM router status...");

  const response = await fetch(`${API_URL}/llm/status`);
  const data = await response.json();

  console.log("✅ LLM Status:");
  console.log(data);
  return data;
}

/**
 * Example 6: Count tokens
 */
async function countTokens(text: string) {
  console.log("🔢 Counting tokens...");

  const response = await fetch(`${API_URL}/llm/count-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model: "gpt-4",
    }),
  });

  const data = await response.json();
  console.log("✅ Token count:", data.tokenCount);
  console.log("💰 Estimated cost:", data.estimatedCost);
  return data;
}

/**
 * Example 7: Get sandbox status
 */
async function getSandboxStatus(sandboxId: string) {
  console.log("📋 Getting sandbox status...");

  const response = await fetch(`${API_URL}/sandboxes/${sandboxId}`);
  const data = await response.json();

  console.log("✅ Sandbox status:", data);
  return data;
}

/**
 * Example 8: Get sandbox logs
 */
async function getSandboxLogs(sandboxId: string) {
  console.log("📜 Getting sandbox logs...");

  const response = await fetch(`${API_URL}/sandboxes/${sandboxId}/logs?tail=50`);
  const data = await response.json();

  console.log("✅ Sandbox logs:");
  console.log(data.logs);
  return data;
}

/**
 * Example 9: Stop sandbox
 */
async function stopSandbox(sandboxId: string) {
  console.log("🛑 Stopping sandbox...");

  const response = await fetch(`${API_URL}/sandboxes/${sandboxId}/stop`, {
    method: "POST",
  });

  const data = await response.json();
  console.log("✅ Sandbox stopped:", data);
  return data;
}

/**
 * Example 10: Full workflow
 */
async function fullWorkflow() {
  console.log("🚀 Starting full workflow...\n");

  try {
    // 1. Generate project
    const projectData = await generateProject();
    const { projectPath } = projectData;
    const projectId = projectData.projectPath.split("/").slice(-2)[0];

    console.log("\n");

    // 2. Create sandbox
    const sandboxData = await createSandbox(projectId, projectPath);
    const { containerId } = sandboxData;

    console.log("\n");

    // 3. Check LLM status
    await checkLLMStatus();

    console.log("\n");

    // 4. Get LLM completion
    await getLLMCompletion();

    console.log("\n");

    // 5. Stream LLM completion
    await streamLLMCompletion();

    console.log("\n");

    // 6. Count tokens
    await countTokens(
      "The quick brown fox jumps over the lazy dog. This is a test sentence."
    );

    console.log("\n");

    // 7. Get sandbox status
    await getSandboxStatus(containerId);

    console.log("\n");

    // 8. Get sandbox logs
    await getSandboxLogs(containerId);

    console.log("\n");

    // 9. Stop sandbox
    await stopSandbox(containerId);

    console.log("\n✅ Workflow complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run examples
const args = process.argv.slice(2);
const example = args[0] || "full";

switch (example) {
  case "project":
    generateProject();
    break;
  case "sandbox":
    createSandbox("proj_123", "/projects/proj_123/my-app");
    break;
  case "completion":
    getLLMCompletion();
    break;
  case "stream":
    streamLLMCompletion();
    break;
  case "status":
    checkLLMStatus();
    break;
  case "tokens":
    countTokens("Hello, world!");
    break;
  case "full":
    fullWorkflow();
    break;
  default:
    console.log("Unknown example:", example);
}
