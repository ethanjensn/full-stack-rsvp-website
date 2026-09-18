function Qa({ config }) {
  return (
    <main className="page">
      <section className="qa-section">
        <div className="qa-container">
          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>CAN I BRING A GUEST?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>Please check your save the date card for guest information.</p>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>ARE THERE SONG REQUESTS?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>You can request a song when you submit an RSVP.</p>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>WHERE WILL THE CELEBRATIONS TAKE PLACE?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>
                {config.VENUE_NAME_UPPER}
                <br />
                {config.VENUE_ADDRESS}
              </p>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>WHAT IS THE DRESS CODE?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>
                Smart casual (neat, polished attire such as collared shirts,
                blouses, dress pants, or nice jeans; no overly casual clothing
                like gym wear or flip-flops).
              </p>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>ARE YOU SIGNED UP WITH A WEDDING REGISTRY SERVICE?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>
                Your love and well wishes are the most important gifts of all.
                If you would like to contribute further, a registry link can be
                found here:{" "}
                <a href={config.REGISTRY_URL} target="_blank" rel="noopener noreferrer">
                  {config.REGISTRY_URL}
                </a>
              </p>
            </div>
          </div>

          <div className="qa-row">
            <div className="qa-question">
              <p className="label">Question</p>
              <h2>WHAT ARE YOU SERVING FOR DINNER?</h2>
            </div>
            <div className="qa-answer">
              <p className="label">Answer</p>
              <p>
                Entrées: Garlic Herb Chicken Breast, Beef Lasagna
                <br />
                Side dishes: Party Potatoes, Caesar Salad, and Green Beans
                <br />
                Dessert: White Cake with Cream Cheese Frosting
                <br />
                Beverage choices: Water, Tea, Lemonade, Coke and Pepsi products,
                Beer and Wine
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Qa;
