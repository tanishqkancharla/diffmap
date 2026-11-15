import { useState } from "react";
import { Banner, Button, Field, postJson } from "../ui";

const items = [
  { name: "Trail runner, size 9", price: 128 },
  { name: "Merino socks, 3 pack", price: 24 },
];
const subtotal = items.reduce((sum, item) => sum + item.price, 0);
const shippingCost = 8;
const steps = ["Cart", "Shipping", "Payment", "Done"] as const;

export function Checkout() {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState({ name: "", street: "", city: "" });
  const [card, setCard] = useState("");
  const [pending, setPending] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [order, setOrder] = useState<string>();

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeclined(false);
    setPending(true);
    const { status, data } = await postJson("/api/orders", { address, card });
    setPending(false);
    if (status === 200) {
      setOrder(String(data.order));
      setStep(3);
    } else setDeclined(true);
  };

  return (
    <div className="card wide" key="checkout">
      <ol className="steps">
        {steps.map((label, index) => (
          <li
            key={label}
            data-done={index < step}
            aria-current={index === step ? "step" : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <div className="stack" key="cart">
          <h1>Your cart</h1>
          <div>
            {items.map((item) => (
              <div className="line-item" key={item.name}>
                <span>{item.name}</span>
                <span>${item.price}</span>
              </div>
            ))}
          </div>
          <div className="total">
            <span>Subtotal</span>
            <span>${subtotal}</span>
          </div>
          <Button primary block onClick={() => setStep(1)}>
            Check out
          </Button>
        </div>
      )}
      {step === 1 && (
        <form
          className="stack"
          key="shipping"
          onSubmit={(event) => {
            event.preventDefault();
            setStep(2);
          }}
        >
          <h1>Where should we send it?</h1>
          <Field
            label="Full name"
            value={address.name}
            onChange={(event) =>
              setAddress({ ...address, name: event.target.value })
            }
          />
          <Field
            label="Street address"
            value={address.street}
            onChange={(event) =>
              setAddress({ ...address, street: event.target.value })
            }
          />
          <Field
            label="City"
            value={address.city}
            onChange={(event) =>
              setAddress({ ...address, city: event.target.value })
            }
          />
          <div className="row">
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button primary type="submit" style={{ flex: 1 }}>
              Continue to payment
            </Button>
          </div>
        </form>
      )}
      {step === 2 && (
        <form className="stack" key="payment" onSubmit={pay}>
          <h1>Payment</h1>
          {declined && (
            <Banner tone="danger">
              Your card was declined. Try another card or contact your bank.
            </Banner>
          )}
          <Field
            label="Card number"
            inputMode="numeric"
            value={card}
            onChange={(event) => setCard(event.target.value)}
          />
          <div className="total">
            <span>Total with shipping</span>
            <span>${subtotal + shippingCost}</span>
          </div>
          <Button primary block type="submit" pending={pending}>
            Pay ${subtotal + shippingCost}
          </Button>
        </form>
      )}
      {step === 3 && (
        <div className="center" key="done">
          <div className="big-check" aria-hidden>
            ✓
          </div>
          <h1>Order placed</h1>
          <p className="lede">
            Order {order} ships to {address.street || "your address"} in 2–3
            days.
          </p>
        </div>
      )}
    </div>
  );
}
