import os
from datetime import datetime, timezone
from decimal import Decimal

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, get_jwt_identity, jwt_required
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "local-only-change-me")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "local-only-change-me-too")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///shopnova.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60 * 8

db = SQLAlchemy(app)
jwt = JWTManager(app)
origins = [x.strip() for x in os.getenv(
    "CORS_ORIGINS", "http://localhost:8080,http://localhost:5173"
).split(",") if x.strip()]
CORS(app, resources={r"/api/*": {"origins": origins}})


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(180), nullable=False)
    category = db.Column(db.String(80), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False, default="")
    price = db.Column(db.Numeric(10, 2), nullable=False)
    original_price = db.Column(db.Numeric(10, 2), nullable=True)
    rating = db.Column(db.Float, nullable=False, default=4.5)
    image_url = db.Column(db.String(1000), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=50)


class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    product = db.relationship("Product")


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Confirmed")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    items = db.relationship("OrderItem", cascade="all, delete-orphan", lazy=True)


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    product_name = db.Column(db.String(180), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)


def money(value):
    return float(value or 0)


def product_json(p):
    return {
        "id": p.id, "name": p.name, "category": p.category,
        "description": p.description, "price": money(p.price),
        "original_price": money(p.original_price) if p.original_price else None,
        "rating": p.rating, "image_url": p.image_url, "stock": p.stock,
    }


def cart_json(item):
    return {
        "id": item.id, "quantity": item.quantity,
        "product": product_json(item.product),
        "line_total": round(money(item.product.price) * item.quantity, 2),
    }


def seed_products():
    if Product.query.count():
        return
    items = [
        ("Studio Wireless Headphones", "Electronics", "Immersive sound, soft-touch comfort and 40-hour battery life.", 6999, 8999, 4.8, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"),
        ("Everyday Minimal Sneakers", "Fashion", "A versatile low-profile silhouette made for everyday movement.", 3499, 4999, 4.6, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85"),
        ("Aura Smart Watch", "Electronics", "Health insights, bright AMOLED display and all-day battery.", 8999, 11999, 4.7, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"),
        ("Carryall Weekend Bag", "Lifestyle", "A durable, thoughtfully organized companion for short trips.", 4299, 5499, 4.5, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"),
        ("Modern Ceramic Table Lamp", "Home", "Warm ambient lighting with a sculptural, understated finish.", 2799, 3599, 4.4, "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85"),
        ("Performance Running Shoes", "Fashion", "Responsive cushioning and a breathable engineered upper.", 5299, 6999, 4.7, "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=85"),
        ("Essential Skincare Set", "Lifestyle", "A simple daily routine with clean, lightweight essentials.", 1899, 2499, 4.3, "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85"),
        ("Compact Bluetooth Speaker", "Electronics", "Room-filling audio in a portable, minimal design.", 2999, 3999, 4.6, "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85"),
    ]
    for name, category, desc, price, original, rating, image in items:
        db.session.add(Product(
            name=name, category=category, description=desc,
            price=Decimal(str(price)), original_price=Decimal(str(original)),
            rating=rating, image_url=image, stock=50
        ))
    db.session.commit()


@app.get("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        return jsonify(status="ok", database="reachable")
    except Exception:
        return jsonify(status="degraded", database="unavailable"), 503


@app.get("/api/products")
def products():
    query = Product.query
    category = request.args.get("category")
    search = request.args.get("search", "").strip()
    if category and category.lower() != "all":
        query = query.filter(db.func.lower(Product.category) == category.lower())
    if search:
        term = f"%{search}%"
        query = query.filter(db.or_(Product.name.ilike(term), Product.description.ilike(term)))
    return jsonify([product_json(p) for p in query.order_by(Product.id).all()])


@app.get("/api/products/<int:product_id>")
def product_detail(product_id):
    p = db.session.get(Product, product_id)
    if not p:
        return jsonify(error="Product not found"), 404
    return jsonify(product_json(p))


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not name or len(name) > 100 or "@" not in email or len(password) < 8:
        return jsonify(error="Provide a name, valid email and password of at least 8 characters"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with this email already exists"), 409
    user = User(name=name, email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=str(user.id))
    return jsonify(access_token=token, user={"id": user.id, "name": user.name, "email": user.email}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify(error="Invalid email or password"), 401
    token = create_access_token(identity=str(user.id))
    return jsonify(access_token=token, user={"id": user.id, "name": user.name, "email": user.email})


@app.get("/api/cart")
@jwt_required()
def get_cart():
    user_id = int(get_jwt_identity())
    items = CartItem.query.filter_by(user_id=user_id).all()
    return jsonify(items=[cart_json(i) for i in items],
                   total=round(sum(money(i.product.price) * i.quantity for i in items), 2))


@app.post("/api/cart")
@jwt_required()
def add_cart():
    data = request.get_json(silent=True) or {}
    try:
        product_id, quantity = int(data.get("product_id")), int(data.get("quantity", 1))
    except (TypeError, ValueError):
        return jsonify(error="product_id and quantity must be integers"), 400
    if quantity < 1 or quantity > 20:
        return jsonify(error="Quantity must be between 1 and 20"), 400
    product = db.session.get(Product, product_id)
    if not product:
        return jsonify(error="Product not found"), 404
    if product.stock < quantity:
        return jsonify(error="Insufficient stock"), 409
    user_id = int(get_jwt_identity())
    item = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    if item:
        if item.quantity + quantity > min(product.stock, 20):
            return jsonify(error="Requested quantity exceeds available stock or cart limit"), 409
        item.quantity += quantity
    else:
        item = CartItem(user_id=user_id, product_id=product_id, quantity=quantity)
        db.session.add(item)
    db.session.commit()
    return jsonify(cart_json(item)), 201


@app.patch("/api/cart/<int:item_id>")
@jwt_required()
def update_cart(item_id):
    user_id = int(get_jwt_identity())
    item = CartItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify(error="Cart item not found"), 404
    data = request.get_json(silent=True) or {}
    try:
        quantity = int(data.get("quantity"))
    except (TypeError, ValueError):
        return jsonify(error="quantity must be an integer"), 400
    if quantity < 1 or quantity > min(item.product.stock, 20):
        return jsonify(error="Quantity is outside allowed stock/cart limits"), 400
    item.quantity = quantity
    db.session.commit()
    return jsonify(cart_json(item))


@app.delete("/api/cart/<int:item_id>")
@jwt_required()
def delete_cart(item_id):
    user_id = int(get_jwt_identity())
    item = CartItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return jsonify(error="Cart item not found"), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Removed from cart")


@app.post("/api/orders")
@jwt_required()
def create_order():
    user_id = int(get_jwt_identity())
    items = CartItem.query.filter_by(user_id=user_id).all()
    if not items:
        return jsonify(error="Your cart is empty"), 400
    for item in items:
        if item.quantity > item.product.stock:
            return jsonify(error=f"Insufficient stock for {item.product.name}"), 409
    total = sum((item.product.price * item.quantity for item in items), Decimal("0.00"))
    order = Order(user_id=user_id, total=total, status="Confirmed")
    db.session.add(order)
    db.session.flush()
    for item in items:
        item.product.stock -= item.quantity
        db.session.add(OrderItem(
            order_id=order.id, product_id=item.product_id,
            product_name=item.product.name, unit_price=item.product.price,
            quantity=item.quantity
        ))
        db.session.delete(item)
    db.session.commit()
    return jsonify(id=order.id, total=money(order.total), status=order.status), 201


@app.get("/api/orders")
@jwt_required()
def list_orders():
    user_id = int(get_jwt_identity())
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([{
        "id": o.id, "total": money(o.total), "status": o.status,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "items": [{"name": i.product_name, "unit_price": money(i.unit_price), "quantity": i.quantity}
                  for i in o.items]
    } for o in orders])


with app.app_context():
    db.create_all()
    seed_products()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
