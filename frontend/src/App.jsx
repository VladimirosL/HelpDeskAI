import { useEffect, useState } from "react";
import "./index.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [view, setView] = useState("customer");

  // =====================================================
  // CUSTOMER STATE
  // =====================================================

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  // =====================================================
  // TECHNICIAN STATE
  // =====================================================

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // =====================================================
  // CUSTOMER CHAT
  // =====================================================

  async function sendMessage() {
    if (!input.trim() || loading) {
      return;
    }

    const userMessage = {
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: updatedMessages,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Backend request failed"
        );
      }

      const data = await response.json();

      const assistantMessage = {
        role: "assistant",
        content: data.message,
        status: data.status,
      };

      setMessages([
        ...updatedMessages,
        assistantMessage,
      ]);

    } catch (error) {
      console.error(error);

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "I couldn't connect to the support server. Please try again.",
          status: "troubleshooting",
        },
      ]);

    } finally {
      setLoading(false);
    }
  }


  // =====================================================
  // CREATE TICKET
  // =====================================================

  async function createSupportTicket() {
    if (
      ticketLoading ||
      ticketCreated
    ) {
      return;
    }

    setTicketLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/tickets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "IT Support Request",

            description:
              "Issue escalated from HelpDeskAI after AI troubleshooting.",

            conversation: messages,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create support ticket"
        );
      }

      const data = await response.json();

      setTicketCreated(
        data.ticket_id
      );

    } catch (error) {
      console.error(error);

      alert(
        "Could not create support ticket. Please try again."
      );

    } finally {
      setTicketLoading(false);
    }
  }


  // =====================================================
  // CHAT INPUT
  // =====================================================

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }


  function useSuggestion(text) {
    setInput(text);
  }


  // =====================================================
  // LOAD TICKETS
  // =====================================================

  async function loadTickets() {
    setTicketsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/tickets`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load tickets"
        );
      }

      const data =
        await response.json();

      setTickets(data);

    } catch (error) {
      console.error(error);

    } finally {
      setTicketsLoading(false);
    }
  }


  // =====================================================
  // OPEN TICKET
  // =====================================================

  async function openTicket(ticketId) {
    try {
      const response = await fetch(
        `${API_URL}/api/tickets/${ticketId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load ticket");
      }

      const data = await response.json();

      setSelectedTicket(data);

      await loadComments(ticketId);

    } catch (error) {
      console.error(error);
    }
  }

  async function loadComments(ticketId) {
  try {
    const response = await fetch(
      `${API_URL}/api/tickets/${ticketId}/comments`
    );

    if (!response.ok) {
      throw new Error("Failed to load comments");
    }

    const data = await response.json();

    setComments(data);
  } catch (error) {
    console.error(error);
  }
}


async function addComment() {
  if (!commentInput.trim() || commentLoading) {
    return;
  }

  setCommentLoading(true);

  try {
    const response = await fetch(
      `${API_URL}/api/tickets/${selectedTicket.id}/comments`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          author: "Technician",
          content: commentInput.trim(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create comment");
    }

    setCommentInput("");

    await loadComments(
      selectedTicket.id
    );

  } catch (error) {
    console.error(error);

    alert("Could not add comment.");

  } finally {
    setCommentLoading(false);
  }
}

  // =====================================================
  // UPDATE TICKET STATUS
  // =====================================================

  async function updateTicketStatus(
    ticketId,
    status
  ) {
    try {
      const response = await fetch(
        `${API_URL}/api/tickets/${ticketId}/status`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            status: status,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to update ticket"
        );
      }

      const data =
        await response.json();

      console.log(
        "Ticket updated:",
        data
      );

      await openTicket(ticketId);

      await loadTickets();

    } catch (error) {
      console.error(error);

      alert(
        "Could not update ticket status."
      );
    }
  }


  // =====================================================
  // LOAD TECHNICIAN TICKETS
  // =====================================================

  useEffect(() => {
    if (view === "technician") {
      loadTickets();
    }
  }, [view]);


  // =====================================================
  // TECHNICIAN PORTAL
  // =====================================================

  if (view === "technician") {
    return (
      <div className="technician-app">

        <header className="topbar">

          <div className="brand">

            <div className="brand-icon">
              ✦
            </div>

            <div>
              <h1>
                HelpDesk
                <span>AI</span>
              </h1>

              <p>
                Technician Portal
              </p>
            </div>

          </div>

          <button
            className="view-switch"
            onClick={() => {
              setView("customer");
              setSelectedTicket(null);
            }}
          >
            ← Customer view
          </button>

        </header>


        <main className="technician-container">

          {selectedTicket ? (

            <div className="ticket-detail">

              <button
                className="back-button"
                onClick={() =>
                  setSelectedTicket(null)
                }
              >
                ← Back to tickets
              </button>


              <div className="ticket-header">

                <div>

                  <span className="ticket-number">
                    Ticket #{selectedTicket.id}
                  </span>

                  <h2>
                    {selectedTicket.title}
                  </h2>

                  <p>
                    {selectedTicket.description}
                  </p>

                </div>


                <div className="ticket-meta">

                  <span
                    className={`ticket-status ${selectedTicket.status}`}
                  >
                    {selectedTicket.status}
                  </span>

                  <span className="ticket-priority">
                    {selectedTicket.priority}
                  </span>

                </div>

              </div>


              <section className="conversation-card">

                <div className="section-title">
                  Conversation
                </div>


                <div className="technician-conversation">

                  {selectedTicket.conversation?.map(
                    (message, index) => (

                      <div
                        key={index}
                        className={`tech-message ${message.role}`}
                      >

                        <div className="tech-message-label">

                          {message.role ===
                          "user"
                            ? "Customer"
                            : "HelpDeskAI"}

                        </div>


                        <div className="tech-message-content">

                          {message.content}

                        </div>

                      </div>

                    )
                  )}

                </div>

              </section>
                <section className="comments-card">

                  <div className="section-title">
                    Technician notes
                  </div>

                  <div className="comments-list">

                    {comments.length === 0 ? (

                      <div className="no-comments">
                        No technician comments yet.
                      </div>

                    ) : (

                      comments.map((comment) => (

                        <div
                          className="comment"
                          key={comment.id}
                        >

                          <div className="comment-header">

                            <strong>
                              {comment.author}
                            </strong>

                            <span>
                              {new Date(
                                comment.created_at
                              ).toLocaleString()}
                            </span>

                          </div>

                          <div className="comment-content">
                            {comment.content}
                          </div>

                        </div>

                      ))

                    )}

                  </div>


                  <div className="comment-composer">

                    <textarea
                      value={commentInput}
                      onChange={(event) =>
                        setCommentInput(
                          event.target.value
                        )
                      }
                      placeholder="Add a technician note..."
                      rows="3"
                    />

                    <button
                      className="action-button primary"
                      onClick={addComment}
                      disabled={
                        commentLoading ||
                        !commentInput.trim()
                      }
                    >
                      {commentLoading
                        ? "Adding..."
                        : "Add comment"}
                    </button>

                  </div>

                </section>

              <div className="ticket-actions">

                {selectedTicket.status ===
                  "open" && (

                  <button
                    className="action-button secondary"
                    onClick={() =>
                      updateTicketStatus(
                        selectedTicket.id,
                        "in_progress"
                      )
                    }
                  >
                    Take ticket
                  </button>

                )}


                {selectedTicket.status !==
                  "resolved" && (

                  <button
                    className="action-button primary"
                    onClick={() =>
                      updateTicketStatus(
                        selectedTicket.id,
                        "resolved"
                      )
                    }
                  >
                    Resolve ticket
                  </button>

                )}

              </div>

            </div>

          ) : (

            <>

              <div className="dashboard-header">

                <div>

                  <span className="eyebrow">
                    Technician Portal
                  </span>

                  <h2>
                    Support Dashboard
                  </h2>

                  <p>
                    Review and handle issues
                    escalated by HelpDeskAI.
                  </p>

                </div>


                <button
                  className="refresh-button"
                  onClick={loadTickets}
                >
                  ↻ Refresh
                </button>

              </div>


              <div className="ticket-summary">

                <div className="summary-card">

                  <span>
                    Open
                  </span>

                  <strong>
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status ===
                          "open"
                      ).length
                    }
                  </strong>

                </div>


                <div className="summary-card">

                  <span>
                    In progress
                  </span>

                  <strong>
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status ===
                          "in_progress"
                      ).length
                    }
                  </strong>

                </div>


                <div className="summary-card">

                  <span>
                    Resolved
                  </span>

                  <strong>
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status ===
                          "resolved"
                      ).length
                    }
                  </strong>

                </div>

              </div>


              <div className="tickets-section">

                <div className="section-heading">

                  <h3>
                    Tickets
                  </h3>

                  <span>
                    {tickets.length} total
                  </span>

                </div>


                {ticketsLoading ? (

                  <div className="empty-state">
                    Loading tickets...
                  </div>

                ) : tickets.length ===
                  0 ? (

                  <div className="empty-state">
                    No tickets.
                  </div>

                ) : (

                  <div className="ticket-list">

                    {tickets.map(
                      (ticket) => (

                        <div
                          className="ticket-row"
                          key={ticket.id}
                          onClick={() =>
                            openTicket(
                              ticket.id
                            )
                          }
                        >

                          <div className="ticket-icon">
                            !
                          </div>


                          <div className="ticket-info">

                            <div className="ticket-title">

                              #{ticket.id}{" "}
                              {ticket.title}

                            </div>


                            <div className="ticket-description">

                              {ticket.description}

                            </div>


                            <div className="ticket-row-meta">

                              <span
                                className={`status-text ${ticket.status}`}
                              >
                                {ticket.status}
                              </span>

                              <span>
                                •
                              </span>

                              <span>
                                {ticket.priority}
                              </span>

                              <span>
                                •
                              </span>

                              <span>
                                {new Date(
                                  ticket.created_at
                                ).toLocaleString()}
                              </span>

                            </div>

                          </div>


                          <div className="ticket-open">
                            Open →
                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

            </>

          )}

        </main>

      </div>
    );
  }


  // =====================================================
  // CUSTOMER VIEW
  // =====================================================

  return (

    <div className="app">

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            ✦
          </div>

          <div>

            <h1>
              HelpDesk
              <span>AI</span>
            </h1>

            <p>
              AI-powered IT support
            </p>

          </div>

        </div>


        <div className="header-actions">

          <div className="status">

            <span className="status-dot"></span>

            Online

          </div>


          <button
            className="view-switch"
            onClick={() =>
              setView("technician")
            }
          >
            Technician Portal →
          </button>

        </div>

      </header>


      <main className="chat-container">

        {messages.length === 0 ? (

          <div className="welcome">

            <div className="welcome-icon">
              ✦
            </div>

            <h2>
              How can I help?
            </h2>

            <p>
              Describe your IT problem and
              I'll help you troubleshoot it
              step-by-step.
            </p>


            <div className="suggestions">

              <button
                onClick={() =>
                  useSuggestion(
                    "My WiFi isn't working"
                  )
                }
              >
                📡 WiFi isn't working
              </button>


              <button
                onClick={() =>
                  useSuggestion(
                    "I can't log in to my account"
                  )
                }
              >
                🔐 Can't log in
              </button>


              <button
                onClick={() =>
                  useSuggestion(
                    "My computer is very slow"
                  )
                }
              >
                💻 Computer is slow
              </button>

            </div>

          </div>

        ) : (

          <div className="messages">

            {messages.map(
              (message, index) => (

                <div
                  key={index}
                  className={`message-row ${message.role}`}
                >

                  <div className="avatar">

                    {message.role ===
                    "user"
                      ? "U"
                      : "✦"}

                  </div>


                  <div className="message-content">

                    <div className="message-name">

                      {message.role ===
                      "user"
                        ? "You"
                        : "HelpDeskAI"}

                    </div>


                    <div className="message-bubble">

                      {message.content}

                    </div>


                    {message.role ===
                      "assistant" &&
                      message.status ===
                        "solved" && (

                        <div className="status-card solved">

                          <div className="status-card-icon">
                            ✓
                          </div>

                          <div>

                            <strong>
                              Problem solved
                            </strong>

                            <p>
                              Glad I could help!
                              Your issue appears
                              to be resolved.
                            </p>

                          </div>

                        </div>

                      )}


                    {message.role ===
                      "assistant" &&
                      message.status ===
                        "escalate" && (

                        <div className="status-card escalate">

                          <div className="status-card-icon">
                            !
                          </div>


                          <div className="status-card-content">

                            <strong>
                              Technician required
                            </strong>

                            <p>
                              This issue needs
                              further assistance
                              from a technician.
                            </p>


                            {ticketCreated ? (

                              <div className="ticket-created">

                                ✓ Ticket #
                                {ticketCreated}
                                {" "}created

                              </div>

                            ) : (

                              <button
                                className="ticket-button"
                                onClick={
                                  createSupportTicket
                                }
                                disabled={
                                  ticketLoading
                                }
                              >

                                {ticketLoading
                                  ? "Creating ticket..."
                                  : "Create support ticket →"}

                              </button>

                            )}

                          </div>

                        </div>

                      )}

                  </div>

                </div>

              )
            )}


            {loading && (

              <div className="message-row assistant">

                <div className="avatar">
                  ✦
                </div>

                <div className="message-content">

                  <div className="message-name">
                    HelpDeskAI
                  </div>

                  <div className="message-bubble typing">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                </div>

              </div>

            )}

          </div>

        )}

      </main>


      <div className="composer-wrapper">

        <div className="composer">

          <textarea
            value={input}
            onChange={(event) =>
              setInput(
                event.target.value
              )
            }
            onKeyDown={handleKeyDown}
            placeholder="Describe your problem..."
            rows="1"
          />


          <button
            className="send-button"
            onClick={sendMessage}
            disabled={
              loading ||
              !input.trim()
            }
          >
            ↑
          </button>

        </div>


        <p className="composer-hint">
          HelpDeskAI can make mistakes.
          Verify important information.
        </p>

      </div>

    </div>

  );
}

export default App;