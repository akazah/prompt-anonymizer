from src.presidio_handler import PresidioHandler
from faker import Faker

def fake_name(language="ja"):
    fake = Faker(language)
    return fake.name()

def fake_email(language="ja"):
    fake = Faker(language)
    return fake.email()

def fake_address(language="ja"):
    fake = Faker(language)
    return fake.address()

def fake_mobile_phone(language="ja"):
    fake = Faker(language)
    return fake.phone_number()

person_1 = fake_name()
person_2 = fake_name()
email_1 = fake_email()
mobilePhone_1 = fake_mobile_phone()

text = person_1+"について。"+person_1+"のメールアドレスは "+email_1+" です。親戚の"+person_2+"さんの電話番号は "+mobilePhone_1+" です。"
language = "ja"
result_text = PresidioHandler().anonymize_text(text=text, language=language)

def test_anonymize_text():
    assert text != result_text
    assert person_1 not in result_text
    assert person_2 not in result_text
    assert email_1 not in result_text
    assert mobilePhone_1 not in result_text
    # check "人名_1" appears in result_text 2 times
    assert result_text.count("人名_A") == 2
    # check "人名_2" appears in result_text 1 time
    assert result_text.count("人名_B") == 1
    # check "メールアドレス" appears in result_text 1 time
    assert result_text.count("メールアドレス_A") == 1
    # check "電話番号" appears in result_text 1 time
    assert result_text.count("電話番号_A") == 1
    print("\n-----")
    print("Original: "+text)
    print("Anonymized: "+result_text)
    print("-----")
